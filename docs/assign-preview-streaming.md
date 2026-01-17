# Streaming des fichiers de devoirs (Assign Preview) – Guide d’implémentation

Ce document regroupe **les extraits essentiels** et une **doc courte** pour reproduire la feature de streaming/prévisualisation des fichiers de devoirs sur un autre site. Le flux permet :

- de **récupérer les devoirs et les soumissions** via le Web Service Moodle ;
- de **streamer** les fichiers en passant par un **proxy** serveur (le token Moodle n’est jamais exposé côté client) ;
- de **prévisualiser** PDF / images / texte en inline, et proposer un download pour les formats non previewables.

---

## 1) Vue d’ensemble du flux

1. Le client charge la **liste des devoirs** et des **étudiants inscrits** pour un cours.
2. Le client sélectionne des devoirs, puis demande les **fichiers de soumission** d’un étudiant.
3. Le client affiche une modal de prévisualisation et **charge les fichiers via un proxy** (`/api/actions/student-submissions/proxy-file?url=...`) qui stream le contenu de Moodle.

**Flux clé** : `Frontend → API /files → Moodle WS (submission status) → fichiers` puis `Frontend → API /proxy-file → Moodle fileurl (avec token) → stream`.

---

## 2) Proxy serveur pour streamer les fichiers (sécurisé + Range)

La route `GET /api/actions/student-submissions/proxy-file` :

- ajoute le **token Moodle** côté serveur ;
- **stream** le body vers le client ;
- force `Content-Disposition: inline` pour les types previewables ;
- supporte les **Range requests** (utile pour la lecture PDF).

> **Extrait clé** : définition des types previewables + ajout du token + Range + streaming.

```ts
// app/api/actions/student-submissions/proxy-file/route.ts
const PREVIEWABLE_TYPES = [
  'application/pdf',
  'application/json',
  'text/',
  'image/',
];

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) {
    return authResult;
  }

  const fileUrl = request.nextUrl.searchParams.get('url');
  if (!fileUrl) {
    return NextResponse.json({ error: "Le paramètre 'url' est requis." }, { status: 400 });
  }

  const token = getMoodleToken();
  if (!token) {
    return NextResponse.json({ error: 'Configuration Moodle incomplète.' }, { status: 500 });
  }

  const url = new URL(fileUrl);
  url.searchParams.set('token', token);

  const fetchHeaders: Record<string, string> = { 'Accept': '*/*' };
  const rangeHeader = request.headers.get('Range');
  if (rangeHeader) {
    fetchHeaders['Range'] = rangeHeader;
  }

  const response = await fetch(url.toString(), { headers: fetchHeaders });

  const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
  const contentDisposition = response.headers.get('Content-Disposition');

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': 'private, max-age=3600',
  };

  if (isPreviewable(contentType)) {
    headers['Content-Disposition'] = 'inline';
  } else if (contentDisposition) {
    headers['Content-Disposition'] = contentDisposition;
  }

  return new Response(response.body, { status: response.status, headers });
}
```

**Notes d’implémentation :**
- Le proxy évite d’exposer le token Moodle au navigateur.
- On **forward** `Range` et certains headers (`Content-Range`, `Accept-Ranges`) pour la navigation PDF.
- `Content-Disposition` est forcé à `inline` si previewable (PDF, image, texte).

---

## 3) Récupération des devoirs + fichiers (service Moodle)

Le service orchestre les appels Moodle et extrait les fichiers dans `submission_files`.

> **Extrait clé** : filtrage des modules `assign` + extraction des fichiers depuis `plugins`.

```ts
// lib/moodle/studentSubmissionsService.ts
export async function listCourseAssignments(courseId: number): Promise<AssignmentsResult> {
  const contentsResponse = await getCourseContents(courseId);
  const sections = contentsResponse.data || [];
  const assignments: AssignmentInfo[] = [];

  for (const section of sections) {
    for (const mod of section.modules || []) {
      if (mod.modname === 'assign') {
        assignments.push({
          cmid: mod.id,
          assignid: mod.instance,
          name: mod.name,
          visible: mod.visible !== 0,
        });
      }
    }
  }

  return { success: true, data: assignments };
}

function extractFilesFromSubmission(
  plugins: Array<{ type: string; name: string; fileareas?: Array<{ area: string; files: SubmissionFile[] }> }> | undefined,
  assignmentName: string,
  assignid: number,
  cmid: number
): StudentFileInfo[] {
  if (!plugins) return [];
  const files: StudentFileInfo[] = [];

  for (const plugin of plugins) {
    if (plugin.type === 'file' && plugin.fileareas) {
      for (const filearea of plugin.fileareas) {
        if (filearea.area === 'submission_files') {
          for (const file of filearea.files || []) {
            files.push({
              filename: file.filename,
              filepath: file.filepath,
              filesize: file.filesize,
              fileurl: file.fileurl,
              mimetype: file.mimetype,
              assignmentName,
              assignid,
              cmid,
            });
          }
        }
      }
    }
  }

  return files;
}
```

> **Extrait clé** : lecture des statuts de soumission et agrégation des fichiers.

```ts
// lib/moodle/studentSubmissionsService.ts
export async function getStudentFiles(
  userId: number,
  assignments: AssignmentInfo[]
): Promise<StudentFilesResult> {
  const allFiles: StudentFileInfo[] = [];
  let overallStatus: 'submitted' | 'draft' | 'nosubmission' = 'nosubmission';

  const results = await processWithConcurrency(
    assignments,
    async (assignment) => {
      const statusResponse = await getSubmissionStatusFull(assignment.assignid, userId);
      const submission = statusResponse.data?.lastattempt?.submission;
      if (!submission) {
        return { files: [], status: 'nosubmission' as const };
      }

      const submissionStatus = submission.status === 'submitted'
        ? 'submitted'
        : submission.status === 'draft'
          ? 'draft'
          : 'nosubmission';

      const files = extractFilesFromSubmission(
        submission.plugins,
        assignment.name,
        assignment.assignid,
        assignment.cmid
      );

      return { files, status: submissionStatus };
    },
    CONCURRENCY_LIMIT
  );

  for (const result of results) {
    allFiles.push(...result.files);
    if (result.status === 'submitted') {
      overallStatus = 'submitted';
    } else if (result.status === 'draft' && overallStatus !== 'submitted') {
      overallStatus = 'draft';
    }
  }

  return {
    success: true,
    data: {
      userId,
      firstName: userInfo?.firstname || '',
      lastName: userInfo?.lastname || '',
      email: userInfo?.email,
      files: allFiles,
      status: overallStatus,
    },
  };
}
```

---

## 4) Endpoints API (assignments, files, students)

Ces routes exposent l’API serveur utilisée par le front :

- `GET /api/actions/student-submissions/assignments?courseId=...`
- `GET /api/actions/student-submissions/enrolled-students?courseId=...`
- `POST /api/actions/student-submissions/files` avec `{ userId, assignments }`

> **Extraits clés** : validation + appel service.

```ts
// app/api/actions/student-submissions/assignments/route.ts
const courseId = parseInt(courseIdParam, 10);
const result = await listCourseAssignments(courseId);
return NextResponse.json({ success: true, assignments: result.data });
```

```ts
// app/api/actions/student-submissions/files/route.ts
const { userId, assignments } = body as {
  userId: number;
  assignments: AssignmentInfo[];
};

const result = await getStudentFiles(userId, assignments);
return NextResponse.json({ success: true, data: result.data });
```

```ts
// app/api/actions/student-submissions/enrolled-students/route.ts
const courseId = parseInt(courseIdParam, 10);
const result = await listEnrolledStudents(courseId);
return NextResponse.json({ success: true, students: result.data });
```

---

## 5) UI de prévisualisation (modal)

La modal :

- construit l’URL de proxy :
  `const proxyUrl = /api/actions/student-submissions/proxy-file?url=...` ;
- affiche **images** (img), **PDF** (iframe), **text/json** (iframe), sinon download ;
- gère le **loading**, les erreurs et les raccourcis clavier.

> **Extrait clé** : choix du rendu + proxy.

```tsx
// components/student-submissions/FilePreviewModal.tsx
const proxyUrl = `/api/actions/student-submissions/proxy-file?url=${encodeURIComponent(currentFile.fileurl)}`;

if (mimetype.startsWith('image/')) {
  return <img src={proxyUrl} alt={currentFile.filename} />;
}

if (mimetype === 'application/pdf') {
  return <iframe src={proxyUrl} title={currentFile.filename} />;
}

if (mimetype.startsWith('text/') || mimetype === 'application/json') {
  return <iframe src={proxyUrl} title={currentFile.filename} />;
}

return (
  <a href={proxyUrl} download={currentFile.filename}>Télécharger</a>
);
```

---

## 6) Config requise

Variables d’environnement nécessaires :

```env
MOODLE_BASE_URL=https://moodle.example.com
MOODLE_WS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Le token est **utilisé côté serveur uniquement** pour appeler Moodle WS et streamer les fichiers.

---

## 7) Schémas de données utiles

**AssignmentInfo** (côté client/serveur) :

```ts
interface AssignmentInfo {
  cmid: number;
  assignid: number;
  name: string;
  visible: boolean;
}
```

**StudentFileInfo** (retourné pour le preview) :

```ts
interface StudentFileInfo {
  filename: string;
  filepath: string;
  filesize: number;
  fileurl: string; // URL Moodle brute (le proxy injecte le token)
  mimetype: string;
  assignmentName: string;
  assignid: number;
  cmid: number;
}
```

---

## 8) Étapes d’implémentation sur un autre site

1. **Créer un proxy** serveur qui stream les fichiers Moodle, en injectant `token` et en supportant `Range`.
2. **Créer un service** pour :
   - lister les devoirs d’un cours (`core_course_get_contents`),
   - récupérer les statuts de soumission (`mod_assign_get_submission_status`),
   - extraire `submission_files` depuis les plugins.
3. **Créer les endpoints API** qui exposent : assignments, étudiants inscrits, fichiers d’un étudiant.
4. **Côté UI**, afficher une modal de preview :
   - images via `<img>` ;
   - PDF via `<iframe>` ;
   - text/json via `<iframe>` ;
   - autres via download.
5. **Sécurité** : toujours exiger une auth côté serveur pour les routes et ne pas exposer le token Moodle au client.

---

## 9) Références des fichiers sources

- `app/api/actions/student-submissions/proxy-file/route.ts` (proxy streaming + Range)
- `lib/moodle/studentSubmissionsService.ts` (listes + extraction fichiers)
- `lib/moodle/client.ts` (Moodle WS + token)
- `components/student-submissions/FilePreviewModal.tsx` (rendu preview)
- `app/api/actions/student-submissions/assignments/route.ts`
- `app/api/actions/student-submissions/files/route.ts`
- `app/api/actions/student-submissions/enrolled-students/route.ts`
- `app/actions/student-submissions/page.tsx` (UI d’accès)
