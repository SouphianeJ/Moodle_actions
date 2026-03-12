import 'server-only';
import * as soap from 'soap';

interface SoapConfig {
  wsdlUrl: string;
  username: string;
  password: string;
}

type SoapArray<T> = T | T[] | null | undefined;

interface TousLesEnseignantsResponse {
  THpSvcWCleEnseignant?: SoapArray<string | number>;
}

interface StringListResponse {
  string?: SoapArray<string>;
}

export interface HyperplanningTeacher {
  id: string;
  email: string;
  code: string;
  firstName: string;
  lastName: string;
  statut: string;
  categories: string[];
}

export interface HyperplanningCourse {
  courseId: string;
  subject: string;
  courseType: string;
  courseDates: string[];
}

export interface HyperplanningTeacherWithCourses extends HyperplanningTeacher {
  courses: HyperplanningCourse[];
}

class HyperplanningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HyperplanningError';
  }
}

function getSoapConfig(): SoapConfig {
  const wsdlUrl = process.env.SOAP_WSDL_URL;
  const username = process.env.SOAP_USERNAME;
  const password = process.env.SOAP_PASSWORD;

  if (!wsdlUrl || !username || !password) {
    throw new HyperplanningError(
      'Hyperplanning configuration is incomplete. Expected SOAP_WSDL_URL, SOAP_USERNAME and SOAP_PASSWORD.',
    );
  }

  return { wsdlUrl, username, password };
}

async function createSoapClient(): Promise<soap.Client> {
  const config = getSoapConfig();

  try {
    const client = await soap.createClientAsync(config.wsdlUrl, {
      wsdl_options: {
        auth: `${config.username}:${config.password}`,
      },
      forceSoap12Headers: true,
    });

    client.setSecurity(new soap.BasicAuthSecurity(config.username, config.password));
    return client;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SOAP error';
    throw new HyperplanningError(`Failed to create Hyperplanning SOAP client: ${message}`);
  }
}

function unwrapReturn<T>(value: T | { return?: T }): T {
  if (value && typeof value === 'object' && 'return' in value) {
    const inner = (value as { return?: T }).return;
    if (inner !== undefined) {
      return inner;
    }
  }

  return value as T;
}

function normalizeArray<T>(value: SoapArray<T>): T[] {
  if (value === null || value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizeLabelForMatch(label: string): string {
  return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function unwrapSoapString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && '$value' in value) {
    return String((value as { $value?: string | number }).$value ?? '');
  }

  return '';
}

function isIlepsEmail(email: string): boolean {
  return email.toLowerCase().includes('@ileps.fr');
}

function formatSoapDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function processInChunks<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  chunkSize: number,
): Promise<R[]> {
  const run = async () => {
    const results: R[] = [];

    for (let index = 0; index < items.length; index += chunkSize) {
      const chunk = items.slice(index, index + chunkSize);
      results.push(...(await Promise.all(chunk.map(processor))));
    }

    return results;
  };

  return run();
}

async function getTeacherRubriqueLabelsByFamily(
  client: soap.Client,
  teacherId: string,
  familyKey: string,
  rubriqueLabelCache: Map<string, string>,
): Promise<string[]> {
  const [rubRes] = await client.RubriqueDeLEnseignantDeFamilleAsync({
    AFamille: familyKey,
    AEnseignant: teacherId,
  });
  const rubPayload = unwrapReturn<{ THpSvcWCleRubrique?: SoapArray<string | number> }>(
    rubRes as { THpSvcWCleRubrique?: SoapArray<string | number> },
  );
  const rubKeys = normalizeArray(rubPayload.THpSvcWCleRubrique).map((key) => String(key));

  const labels: string[] = [];
  for (const rubKey of rubKeys) {
    if (rubriqueLabelCache.has(rubKey)) {
      labels.push(rubriqueLabelCache.get(rubKey) || '');
      continue;
    }

    const [labelRes] = await client.LibelleRubriqueAsync({ ARubrique: rubKey });
    const labelPayload = unwrapReturn<{ $value?: string } | string>(
      labelRes as { $value?: string } | string,
    );
    const label = unwrapSoapString(labelPayload);
    rubriqueLabelCache.set(rubKey, label);
    if (label) {
      labels.push(label);
    }
  }

  return labels;
}

async function getTeacherFamilyKeys(client: soap.Client): Promise<{
  typeFamilyKey: string;
  categoriesFamilyKey: string;
}> {
  let typeFamilyKey = '';
  let categoriesFamilyKey = '';

  const [familiesRes] = await client.ToutesLesFamillesDuGenreAsync({
    AGenre: 'gfEnseignant',
  });
  const familiesPayload = unwrapReturn<{ THpSvcWCleFamille?: SoapArray<string | number> }>(
    familiesRes as { THpSvcWCleFamille?: SoapArray<string | number> },
  );
  const familyKeys = normalizeArray(familiesPayload.THpSvcWCleFamille).map((key) => String(key));

  for (const familyKey of familyKeys) {
    const [labelRes] = await client.LibelleFamilleAsync({ AFamille: familyKey });
    const labelPayload = unwrapReturn<{ $value?: string } | string>(
      labelRes as { $value?: string } | string,
    );
    const normalized = normalizeLabelForMatch(unwrapSoapString(labelPayload));

    if (normalized === 'type') {
      typeFamilyKey = familyKey;
    } else if (normalized === 'categories') {
      categoriesFamilyKey = familyKey;
    }
  }

  return { typeFamilyKey, categoriesFamilyKey };
}

export function getCurrentAcademicYearRange(referenceDate = new Date()) {
  const year = referenceDate.getMonth() >= 8 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1;
  const start = new Date(year, 8, 1);
  const end = new Date(year + 1, 7, 31);

  return {
    start,
    end,
    startText: formatSoapDate(start),
    endText: formatSoapDate(end),
    scope: `${year}-${year + 1}`,
  };
}

export async function getIlepsTeachers(): Promise<HyperplanningTeacher[]> {
  const client = await createSoapClient();
  const [teachersResult] = await client.TousLesEnseignantsAsync(null);
  const teachersPayload = unwrapReturn<TousLesEnseignantsResponse>(teachersResult as TousLesEnseignantsResponse);
  const teacherIds = normalizeArray(teachersPayload.THpSvcWCleEnseignant).map((id) => String(id));

  if (teacherIds.length === 0) {
    return [];
  }

  const [emailsResult, lastNamesResult, firstNamesResult, codesResult] = await Promise.all([
    client.EMailsTableauDEnseignantsAsync({
      ATableau: { THpSvcWCleEnseignant: teacherIds },
    }),
    client.NomsTableauDEnseignantsAsync({
      ATableau: { THpSvcWCleEnseignant: teacherIds },
    }),
    client.PrenomsTableauDEnseignantsAsync({
      ATableau: { THpSvcWCleEnseignant: teacherIds },
    }),
    client.CodesTableauDEnseignantsAsync({
      ATableau: { THpSvcWCleEnseignant: teacherIds },
    }),
  ]);

  const [emailsResponse] = emailsResult as [StringListResponse];
  const [lastNamesResponse] = lastNamesResult as [StringListResponse];
  const [firstNamesResponse] = firstNamesResult as [StringListResponse];
  const [codesResponse] = codesResult as [StringListResponse];

  const emails = normalizeArray(unwrapReturn<StringListResponse>(emailsResponse).string).map((value) => String(value || ''));
  const lastNames = normalizeArray(unwrapReturn<StringListResponse>(lastNamesResponse).string).map((value) => String(value || ''));
  const firstNames = normalizeArray(unwrapReturn<StringListResponse>(firstNamesResponse).string).map((value) => String(value || ''));
  const codes = normalizeArray(unwrapReturn<StringListResponse>(codesResponse).string).map((value) => String(value || ''));

  let typeFamilyKey = '';
  let categoriesFamilyKey = '';
  try {
    const familyKeys = await getTeacherFamilyKeys(client);
    typeFamilyKey = familyKeys.typeFamilyKey;
    categoriesFamilyKey = familyKeys.categoriesFamilyKey;
  } catch {
    typeFamilyKey = '';
    categoriesFamilyKey = '';
  }

  const rubriqueLabelCache = new Map<string, string>();
  const teachers = await processInChunks(
    teacherIds.map((teacherId, index) => ({
      teacherId,
      index,
    })),
    async ({ teacherId, index }) => {
      const email = index < emails.length ? emails[index] : '';
      let statut = '';
      let categories: string[] = [];

      if (typeFamilyKey) {
        try {
          const labels = await getTeacherRubriqueLabelsByFamily(
            client,
            teacherId,
            typeFamilyKey,
            rubriqueLabelCache,
          );
          statut = labels[0] || '';
        } catch {
          statut = '';
        }
      }

      if (categoriesFamilyKey) {
        try {
          categories = await getTeacherRubriqueLabelsByFamily(
            client,
            teacherId,
            categoriesFamilyKey,
            rubriqueLabelCache,
          );
        } catch {
          categories = [];
        }
      }

      return {
        id: teacherId,
        email,
        code: index < codes.length ? codes[index] : '',
        firstName: index < firstNames.length ? firstNames[index] : '',
        lastName: index < lastNames.length ? lastNames[index] : '',
        statut,
        categories,
      } satisfies HyperplanningTeacher;
    },
    5,
  );

  return teachers
    .filter((teacher) => isIlepsEmail(teacher.email))
    .sort((left, right) => {
      const lastNameCompare = left.lastName.localeCompare(right.lastName, 'fr');
      if (lastNameCompare !== 0) {
        return lastNameCompare;
      }

      return left.firstName.localeCompare(right.firstName, 'fr');
    });
}

async function getTeacherCoursesForRangeWithClient(
  client: soap.Client,
  teacherId: string,
  startText: string,
  endText: string,
): Promise<HyperplanningCourse[]> {
  const [coursRes] = await client.CoursEnseignantEntre2DatesAsync({
    AEnseignant: teacherId,
    ADate1: startText,
    ADate2: endText,
  });
  const coursPayload = unwrapReturn<{ THpSvcWCleCours?: SoapArray<string | number> }>(
    coursRes as { THpSvcWCleCours?: SoapArray<string | number> },
  );
  const courseKeys = normalizeArray(coursPayload.THpSvcWCleCours).map((key) => String(key));

  if (courseKeys.length === 0) {
    return [];
  }

  const [[matieresRes], [typesRes], [unplacedRes]] = await Promise.all([
    client.MatieresTableauDeCoursAsync({
      ATableau: { THpSvcWCleCours: courseKeys },
    }),
    client.TypesTableauDeCoursAsync({
      ATableau: { THpSvcWCleCours: courseKeys },
    }),
    client.SontCoursNonPlacesAsync({
      ATableau: { THpSvcWCleCours: courseKeys },
    }),
  ]);

  const matieresPayload = unwrapReturn<{ THpSvcWCleMatiere?: SoapArray<string | number> }>(
    matieresRes as { THpSvcWCleMatiere?: SoapArray<string | number> },
  );
  const typesPayload = unwrapReturn<StringListResponse>(typesRes as StringListResponse);
  const unplacedPayload = unwrapReturn<{ boolean?: SoapArray<boolean | string | number> }>(
    unplacedRes as { boolean?: SoapArray<boolean | string | number> },
  );

  const matiereKeys = normalizeArray(matieresPayload.THpSvcWCleMatiere).map((key) => String(key || ''));
  const courseTypes = normalizeArray(typesPayload.string).map((value) => String(value || ''));
  const unplacedFlags = normalizeArray(unplacedPayload.boolean).map((value) => value === true || value === 'true' || value === 1 || value === '1');

  const uniqueMatiereKeys = Array.from(new Set(matiereKeys.filter(Boolean)));
  const matiereLabels = new Map<string, string>();
  if (uniqueMatiereKeys.length > 0) {
    const [labelsRes] = await client.LibellesTableauDeMatieresAsync({
      ATableau: { THpSvcWCleMatiere: uniqueMatiereKeys },
    });
    const labelsPayload = unwrapReturn<StringListResponse>(labelsRes as StringListResponse);
    const labels = normalizeArray(labelsPayload.string).map((value) => String(value || ''));

    uniqueMatiereKeys.forEach((key, index) => {
      matiereLabels.set(key, index < labels.length ? labels[index] : '');
    });
  }

  let seances: Record<string, unknown>[] = [];
  const placedCourseKeys = courseKeys.filter((_, index) => !unplacedFlags[index]);

  if (placedCourseKeys.length > 0) {
    try {
      const [detailRes] = await client.DetailDesSeancesPlaceesTableauDeCoursAsync({
        ATableau: { THpSvcWCleCours: placedCourseKeys },
      });
      const detailPayload = unwrapReturn<{ THpSvcWTypeSeance?: SoapArray<Record<string, unknown>> }>(
        detailRes as { THpSvcWTypeSeance?: SoapArray<Record<string, unknown>> },
      );
      seances = normalizeArray(detailPayload.THpSvcWTypeSeance);
    } catch {
      seances = [];
    }
  }

  const courseDatesById = new Map<string, Set<string>>();
  for (const seance of seances) {
    const courseRaw = (seance as Record<string, unknown>).Cours;
    const courseId =
      courseRaw && typeof courseRaw === 'object' && '$value' in courseRaw
        ? String((courseRaw as { $value?: string | number }).$value || '')
        : String(courseRaw || '');
    const dateRaw = (seance as Record<string, unknown>).JourEtHeureDebut;
    const dateValue =
      dateRaw && typeof dateRaw === 'object' && '$value' in dateRaw
        ? String((dateRaw as { $value?: string }).$value || '')
        : String(dateRaw || '');

    if (!courseId || !dateValue) {
      continue;
    }

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }

    const dateText = formatSoapDate(parsed);
    if (dateText < startText || dateText > endText) {
      continue;
    }

    if (!courseDatesById.has(courseId)) {
      courseDatesById.set(courseId, new Set<string>());
    }
    courseDatesById.get(courseId)?.add(dateText);
  }

  return courseKeys.map((courseId, index) => {
    const matiereKey = index < matiereKeys.length ? matiereKeys[index] : '';
    const subject = matiereLabels.get(matiereKey) || (matiereKey ? `Matiere ${matiereKey}` : `Cours ${courseId}`);
    const courseType = index < courseTypes.length ? courseTypes[index] : '';
    const courseDates = Array.from(courseDatesById.get(courseId) || []).sort((a, b) => a.localeCompare(b));

    return {
      courseId,
      subject,
      courseType,
      courseDates,
    };
  });
}

export async function getTeacherCoursesForRange(
  teacherId: string,
  startText: string,
  endText: string,
): Promise<HyperplanningCourse[]> {
  const client = await createSoapClient();
  return getTeacherCoursesForRangeWithClient(client, teacherId, startText, endText);
}

export async function getIlepsTeachersWithCoursesForRange(
  startText: string,
  endText: string,
): Promise<HyperplanningTeacherWithCourses[]> {
  const teachers = await getIlepsTeachers();
  if (teachers.length === 0) {
    return [];
  }

  const client = await createSoapClient();
  return processInChunks(
    teachers,
    async (teacher) => ({
      ...teacher,
      courses: await getTeacherCoursesForRangeWithClient(client, teacher.id, startText, endText),
    }),
    3,
  );
}
