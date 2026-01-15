'use client';

import { useState, useCallback } from 'react';
import { AppShell } from '@/components/layout';
import { PageHeader, Card, Input, Button, Alert, Checkbox } from '@/components/ui';
import { FilePreviewModal } from '@/components/student-submissions/FilePreviewModal';
import { formatFileSize } from '@/lib/utils/format';

type AlertState = {
  variant: 'info' | 'success' | 'warning' | 'error';
  message: string;
} | null;

interface AssignmentInfo {
  cmid: number;
  assignid: number;
  name: string;
  visible: boolean;
}

interface StudentFileInfo {
  filename: string;
  filepath: string;
  filesize: number;
  fileurl: string;
  mimetype: string;
  assignmentName: string;
  assignid: number;
  cmid: number;
}

interface StudentSubmissionData {
  userId: number;
  firstName: string;
  lastName: string;
  email?: string;
  files: StudentFileInfo[];
  status: 'submitted' | 'draft' | 'nosubmission';
}

interface EnrolledStudent {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
}

export default function StudentSubmissionsPage() {
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<number>>(new Set());
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number>(-1);
  const [studentData, setStudentData] = useState<StudentSubmissionData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleLoadAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const id = courseId.trim();
    
    if (!/^\d+$/.test(id) || parseInt(id, 10) <= 0) {
      setAlert({
        variant: 'error',
        message: "L'identifiant du cours doit être un nombre entier positif.",
      });
      return;
    }
    
    setLoading(true);
    setAlert(null);
    setAssignments([]);
    setSelectedAssignments(new Set());
    setEnrolledStudents([]);
    setSelectedStudentIndex(-1);
    setStudentData(null);
    
    try {
      // Fetch assignments and enrolled students in parallel
      const [assignmentsResponse, studentsResponse] = await Promise.all([
        fetch(`/api/actions/student-submissions/assignments?courseId=${id}`),
        fetch(`/api/actions/student-submissions/enrolled-students?courseId=${id}`),
      ]);
      
      const assignmentsData = await assignmentsResponse.json();
      const studentsData = await studentsResponse.json();
      
      if (!assignmentsResponse.ok) {
        throw new Error(assignmentsData.error || `Erreur ${assignmentsResponse.status}`);
      }
      
      if (assignmentsData.assignments && assignmentsData.assignments.length > 0) {
        setAssignments(assignmentsData.assignments);
      } else {
        setAlert({
          variant: 'warning',
          message: 'Aucun devoir trouvé dans ce cours.',
        });
        return;
      }
      
      if (studentsResponse.ok && studentsData.students && studentsData.students.length > 0) {
        setEnrolledStudents(studentsData.students);
        setAlert({
          variant: 'success',
          message: `${assignmentsData.assignments.length} devoir(s) et ${studentsData.students.length} étudiant(s) trouvé(s).`,
        });
      } else {
        setAlert({
          variant: 'warning',
          message: `${assignmentsData.assignments.length} devoir(s) trouvé(s), mais aucun étudiant inscrit.`,
        });
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
      setAlert({
        variant: 'error',
        message: error instanceof Error ? error.message : 'Impossible de charger les devoirs.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentToggle = (assignid: number) => {
    setSelectedAssignments(prev => {
      const next = new Set(prev);
      if (next.has(assignid)) {
        next.delete(assignid);
      } else {
        next.add(assignid);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedAssignments.size === assignments.length) {
      setSelectedAssignments(new Set());
    } else {
      setSelectedAssignments(new Set(assignments.map(a => a.assignid)));
    }
  };

  const loadStudentFilesForIndex = useCallback(async (studentIndex: number) => {
    if (studentIndex < 0 || studentIndex >= enrolledStudents.length) return;
    
    const student = enrolledStudents[studentIndex];
    
    if (selectedAssignments.size === 0) {
      setAlert({
        variant: 'error',
        message: 'Veuillez sélectionner au moins un devoir.',
      });
      return;
    }
    
    setLoadingFiles(true);
    setAlert(null);
    setStudentData(null);
    setSelectedStudentIndex(studentIndex);
    
    try {
      const selectedAssignmentsList = assignments.filter(a => selectedAssignments.has(a.assignid));
      
      const response = await fetch('/api/actions/student-submissions/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: student.id,
          assignments: selectedAssignmentsList,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Erreur ${response.status}`);
      }
      
      setStudentData(data.data);
      
      if (data.data.files.length > 0) {
        setAlert({
          variant: 'success',
          message: `${data.data.files.length} fichier(s) trouvé(s) pour ${student.firstName} ${student.lastName}.`,
        });
      } else {
        setAlert({
          variant: 'warning',
          message: `Aucun fichier soumis trouvé pour ${student.firstName} ${student.lastName}.`,
        });
      }
    } catch (error) {
      console.error('Error loading student files:', error);
      setAlert({
        variant: 'error',
        message: error instanceof Error ? error.message : 'Impossible de charger les fichiers.',
      });
    } finally {
      setLoadingFiles(false);
    }
  }, [enrolledStudents, selectedAssignments, assignments]);

  const handleStudentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value, 10);
    if (index >= 0) {
      loadStudentFilesForIndex(index);
    } else {
      setSelectedStudentIndex(-1);
      setStudentData(null);
    }
  };

  const handleOpenPreview = () => {
    if (studentData && studentData.files.length > 0) {
      setShowPreview(true);
    }
  };

  const handleNextStudent = useCallback(async () => {
    // Move to the next student in the enrolled list
    if (selectedStudentIndex < 0 || selectedStudentIndex >= enrolledStudents.length - 1) {
      // No next student available
      return;
    }
    
    const nextIndex = selectedStudentIndex + 1;
    const nextStudent = enrolledStudents[nextIndex];
    
    setLoadingFiles(true);
    setAlert(null);
    setSelectedStudentIndex(nextIndex);
    
    try {
      const selectedAssignmentsList = assignments.filter(a => selectedAssignments.has(a.assignid));
      
      const response = await fetch('/api/actions/student-submissions/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: nextStudent.id,
          assignments: selectedAssignmentsList,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Erreur ${response.status}`);
      }
      
      setStudentData(data.data);
      
      if (data.data.files.length === 0) {
        setAlert({
          variant: 'warning',
          message: `Aucun fichier soumis trouvé pour ${nextStudent.firstName} ${nextStudent.lastName}.`,
        });
      }
    } catch (error) {
      console.error('Error loading next student:', error);
      setAlert({
        variant: 'error',
        message: error instanceof Error ? error.message : 'Impossible de charger les fichiers.',
      });
    } finally {
      setLoadingFiles(false);
    }
  }, [selectedStudentIndex, enrolledStudents, assignments, selectedAssignments]);

  return (
    <AppShell>
      <PageHeader
        title="Voir les rendus étudiants"
        description="Visualisez les fichiers soumis par les étudiants pour un ou plusieurs devoirs."
      />
      
      {/* Step 1: Load assignments */}
      <Card className="max-w-2xl mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Étape 1 : Charger les devoirs du cours
        </h2>
        <form onSubmit={handleLoadAssignments} className="flex gap-4 items-end">
          <div className="flex-1">
            <Input
              type="text"
              label="ID du cours"
              placeholder="Ex: 123"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              helper="L'ID du cours se trouve dans l'URL Moodle."
            />
          </div>
          <Button
            type="submit"
            disabled={!courseId.trim() || loading}
            loading={loading}
          >
            Charger
          </Button>
        </form>
      </Card>
      
      {/* Step 2: Select assignments */}
      {assignments.length > 0 && (
        <Card className="max-w-2xl mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Étape 2 : Sélectionner les devoirs
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedAssignments.size === assignments.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </Button>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {assignments.map((assignment) => (
              <div
                key={assignment.assignid}
                className={`
                  p-3 rounded-lg border transition-colors
                  ${selectedAssignments.has(assignment.assignid)
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${!assignment.visible ? 'opacity-60' : ''}
                `}
              >
                <Checkbox
                  checked={selectedAssignments.has(assignment.assignid)}
                  onChange={() => handleAssignmentToggle(assignment.assignid)}
                  label={assignment.name}
                />
                {!assignment.visible && (
                  <span className="ml-7 text-xs text-gray-500">(masqué)</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-500">
            {selectedAssignments.size} devoir(s) sélectionné(s)
          </p>
        </Card>
      )}
      
      {/* Step 3: Select student from list */}
      {selectedAssignments.size > 0 && enrolledStudents.length > 0 && (
        <Card className="max-w-2xl mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Étape 3 : Sélectionner un étudiant
          </h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Étudiant
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedStudentIndex}
                onChange={handleStudentSelect}
                disabled={loadingFiles}
              >
                <option value={-1}>-- Sélectionner un étudiant --</option>
                {enrolledStudents.map((student, index) => (
                  <option key={student.id} value={index}>
                    {student.lastName} {student.firstName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {enrolledStudents.length} étudiant(s) inscrit(s) au cours
              </p>
            </div>
            {loadingFiles && (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm">Chargement...</span>
              </div>
            )}
          </div>
        </Card>
      )}
      
      {/* Student files summary */}
      {studentData && (
        <Card className="max-w-2xl mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Fichiers de {studentData.firstName} {studentData.lastName}
          </h2>
          
          {studentData.files.length > 0 ? (
            <>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {studentData.files.map((file, idx) => (
                  <div
                    key={`${file.assignid}-${file.filename}-${idx}`}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {file.assignmentName} • {formatFileSize(file.filesize)}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 ml-2">
                      {file.mimetype.split('/')[1]?.toUpperCase() || file.mimetype}
                    </span>
                  </div>
                ))}
              </div>
              <Button onClick={handleOpenPreview}>
                Prévisualiser les fichiers
              </Button>
            </>
          ) : (
            <p className="text-gray-500">Aucun fichier soumis.</p>
          )}
        </Card>
      )}
      
      {alert && (
        <Alert variant={alert.variant} className="max-w-2xl">
          {alert.message}
        </Alert>
      )}
      
      {/* File preview modal */}
      {showPreview && studentData && studentData.files.length > 0 && (
        <FilePreviewModal
          key={studentData.userId}
          studentData={studentData}
          onClose={() => setShowPreview(false)}
          onNextStudent={handleNextStudent}
        />
      )}
    </AppShell>
  );
}
