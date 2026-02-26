import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTeacherContext } from '@/context/TeacherContext';
import { useClassroomInsights } from '@/hooks/useClassroomInsights';
import SmartMarkdown from '@/components/shared/SmartMarkdown';
import { TopicCell, StudentSnapshot, SemanticCluster } from '../../../../shared/types/insight.types';

// ============================================================
// Cell color based on struggle score
// ============================================================

function getCellColor(cell: TopicCell): string {
  if (!cell.hasData) return 'bg-white/5 text-white/30 border-white/10';
  const s = cell.struggleScore ?? 0;
  if (s < 0.20) return 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200';
  if (s < 0.40) return 'bg-green-500/20 border-green-400/30 text-green-200';
  if (s < 0.60) return 'bg-yellow-500/20 border-yellow-400/30 text-yellow-200';
  if (s < 0.80) return 'bg-orange-500/20 border-orange-400/30 text-orange-200';
  return 'bg-red-500/20 border-red-400/30 text-red-200';
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'low': return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
    case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-400/30';
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-400/30';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
}

// ============================================================
// CellDetail – right panel showing selected cell data
// ============================================================

interface CellDetailProps {
  cell: TopicCell;
  studentName: string;
}

function CellDetail({ cell, studentName }: CellDetailProps) {
  const { t } = useTranslation();

  if (!cell.hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-white/40 text-sm">
        <svg className="w-8 h-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>{t('teacher.insights.heatmap.noActivity')}</p>
      </div>
    );
  }

  const dims = cell.struggleDimensions;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-white/80">{studentName}</p>
        <p className="text-xs text-white/50 truncate">{cell.lessonTitle}</p>
      </div>

      {/* Struggle Score */}
      {cell.struggleScore !== null && (
        <div>
          <div className="flex justify-between text-xs text-white/60 mb-1">
            <span>Dificultad Global</span>
            <span>{Math.round(cell.struggleScore * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                cell.struggleScore < 0.4 ? 'bg-emerald-400' :
                cell.struggleScore < 0.6 ? 'bg-yellow-400' :
                cell.struggleScore < 0.8 ? 'bg-orange-400' : 'bg-red-400'
              }`}
              style={{ width: `${cell.struggleScore * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Struggle Dimensions */}
      {dims && (
        <div>
          <p className="text-xs font-semibold text-white/60 mb-2 uppercase tracking-wide">
            {t('teacher.insights.detail.struggleDimensions')}
          </p>
          <div className="space-y-2">
            {[
              { key: 'socraticDepth', label: t('teacher.insights.detail.socraticDepth'), value: dims.socraticDepth },
              { key: 'errorPersistence', label: t('teacher.insights.detail.errorPersistence'), value: dims.errorPersistence },
              { key: 'frustrationSentiment', label: t('teacher.insights.detail.frustrationSentiment'), value: dims.frustrationSentiment },
            ].map(({ key, label, value }) => (
              <div key={key}>
                <div className="flex justify-between text-xs text-white/50 mb-0.5">
                  <span>{label}</span>
                  <span>{Math.round(value * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-400/60 transition-all"
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exit Ticket */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/50">{t('teacher.insights.detail.exitTicket')}:</span>
        {cell.exitTicketPassed === null ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40">
            {t('teacher.insights.detail.pending')}
          </span>
        ) : cell.exitTicketPassed ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300">
            {t('teacher.insights.detail.passed')}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/30 text-red-300">
            {t('teacher.insights.detail.failed')}
          </span>
        )}
      </div>

      {/* Rubric Scores */}
      {cell.rubricScores && (
        <div>
          <p className="text-xs font-semibold text-white/60 mb-2 uppercase tracking-wide">
            {t('teacher.insights.detail.rubricScores')}
          </p>
          <div className="space-y-2">
            {[
              { label: t('teacher.insights.detail.accuracy'), value: cell.rubricScores.accuracy },
              { label: t('teacher.insights.detail.reasoning'), value: cell.rubricScores.reasoning },
              { label: t('teacher.insights.detail.effort'), value: cell.rubricScores.effort },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-white/50 mb-0.5">
                  <span>{label}</span>
                  <span>{value}/100</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400/60 transition-all"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submission Grade */}
      {cell.submissionGrade !== null && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">Calificación tarea:</span>
          <span className={`text-sm font-bold ${
            cell.submissionGrade >= 70 ? 'text-emerald-300' :
            cell.submissionGrade >= 50 ? 'text-yellow-300' : 'text-red-300'
          }`}>
            {cell.submissionGrade.toFixed(0)}/100
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Cluster List
// ============================================================

interface ClusterListProps {
  clusters: SemanticCluster[];
}

function ClusterList({ clusters }: ClusterListProps) {
  if (clusters.length === 0) return null;

  const dimensionLabel: Record<string, string> = {
    socraticDepth: 'Profundidad',
    errorPersistence: 'Errores',
    frustrationSentiment: 'Frustración',
  };

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">
        Zonas Muertas Conceptuales
      </p>
      <div className="space-y-2">
        {clusters.map((c, i) => (
          <div
            key={i}
            className="p-2.5 rounded-xl bg-red-500/10 border border-red-400/20 space-y-1"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-red-200 truncate max-w-[160px]">{c.topic}</p>
              <span className="text-xs text-red-300/70">{Math.round(c.avgStruggleScore * 100)}%</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span>{c.studentCount} est.</span>
              <span>•</span>
              <span>{dimensionLabel[c.dominantDimension] ?? c.dominantDimension}</span>
            </div>
            {c.memoryInsight && (
              <p className="text-xs text-white/30 italic truncate">"{c.memoryInsight}"</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function ClassroomInsights() {
  const { t } = useTranslation();
  const { classrooms } = useTeacherContext();
  const { snapshot, audit, isLoadingSnapshot, isGeneratingAudit, error, loadSnapshot, generateAudit } =
    useClassroomInsights();

  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [selectedCell, setSelectedCell] = useState<{ cell: TopicCell; student: StudentSnapshot } | null>(null);

  const handleClassroomChange = (id: string) => {
    setSelectedClassroomId(id);
    setSelectedCell(null);
    if (id) {
      loadSnapshot(id);
    }
  };

  return (
    <div className="h-screen flex flex-col p-6 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-solid">{t('teacher.insights.title')}</h1>
          <p className="text-sm text-prominent">{t('teacher.insights.subtitle')}</p>
        </div>

        {/* Classroom Selector */}
        <div className="flex items-center gap-3">
          <select
            value={selectedClassroomId}
            onChange={e => handleClassroomChange(e.target.value)}
            className="px-3 py-2 rounded-xl backdrop-blur-md bg-white/10 border border-white/20 text-sm text-solid focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          >
            <option value="">{t('teacher.insights.noClassroom')}</option>
            {(classrooms ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex-shrink-0 px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoadingSnapshot && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-white/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
            <p className="text-sm">{t('common.loading')}</p>
          </div>
        </div>
      )}

      {/* No classroom selected */}
      {!selectedClassroomId && !isLoadingSnapshot && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-white/30">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm">{t('teacher.insights.noClassroom')}</p>
          </div>
        </div>
      )}

      {/* Main content: heatmap + detail panel */}
      {snapshot && !isLoadingSnapshot && (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left: Heatmap */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* No data message */}
            {snapshot.students.length === 0 || snapshot.lessons.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
                {t('teacher.insights.noData')}
              </div>
            ) : (
              <div className="flex-1 backdrop-blur-md bg-white/5 border border-white/15 rounded-2xl overflow-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      {/* Student column header */}
                      <th className="sticky left-0 z-20 bg-black/40 backdrop-blur-sm px-3 py-2 text-left text-xs font-semibold text-white/50 uppercase tracking-wide border-b border-r border-white/10 whitespace-nowrap min-w-[140px]">
                        {t('teacher.insights.heatmap.student')}
                      </th>
                      {/* Lesson column headers */}
                      {snapshot.lessons.map(lesson => (
                        <th
                          key={lesson.id}
                          className="px-2 py-2 text-center text-xs font-medium text-white/50 border-b border-white/10 min-w-[80px] max-w-[100px]"
                          title={lesson.title}
                        >
                          <span className="block truncate max-w-[90px]">{lesson.title}</span>
                          {lesson.subject && (
                            <span className="block text-white/30 text-xs font-normal">{lesson.subject}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.students.map((student, i) => (
                      <tr
                        key={student.studentId}
                        className={i % 2 === 0 ? 'bg-white/2' : ''}
                      >
                        {/* Student name */}
                        <td className="sticky left-0 z-10 bg-black/30 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white/70 border-r border-white/10 whitespace-nowrap">
                          {student.studentName}
                        </td>
                        {/* Cells */}
                        {snapshot.lessons.map(lesson => {
                          const cell = student.cells[lesson.id];
                          if (!cell) return (
                            <td key={lesson.id} className="px-1.5 py-1">
                              <div className="h-9 rounded-lg bg-white/5 border border-white/10" title={t('teacher.insights.heatmap.noActivity')} />
                            </td>
                          );

                          return (
                            <td key={lesson.id} className="px-1.5 py-1">
                              <button
                                onClick={() => setSelectedCell({ cell, student })}
                                className={`w-full h-9 rounded-lg border text-xs font-semibold transition-all hover:scale-105 hover:shadow-lg ${getCellColor(cell)} ${
                                  selectedCell?.cell.lessonId === cell.lessonId &&
                                  selectedCell?.student.studentId === student.studentId
                                    ? 'ring-2 ring-white/50'
                                    : ''
                                }`}
                                title={
                                  cell.hasData
                                    ? `${student.studentName} — ${lesson.title}\nDificultad: ${cell.struggleScore !== null ? Math.round(cell.struggleScore * 100) + '%' : 'N/A'}`
                                    : t('teacher.insights.heatmap.noActivity')
                                }
                              >
                                {cell.hasData && cell.struggleScore !== null
                                  ? `${Math.round(cell.struggleScore * 100)}%`
                                  : '—'
                                }
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Color legend */}
            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-white/40">
              <span>Nivel de dificultad:</span>
              {[
                { color: 'bg-emerald-500/30', label: '<20%' },
                { color: 'bg-green-500/30', label: '20-40%' },
                { color: 'bg-yellow-500/30', label: '40-60%' },
                { color: 'bg-orange-500/30', label: '60-80%' },
                { color: 'bg-red-500/30', label: '>80%' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded ${color}`} />
                  <span>{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-white/5" />
                <span>Sin datos</span>
              </div>
            </div>
          </div>

          {/* Right: Detail + Audit panels */}
          <div className="w-72 flex flex-col gap-3 flex-shrink-0 overflow-y-auto">
            {/* Cell Detail */}
            <div className="backdrop-blur-md bg-white/5 border border-white/15 rounded-2xl p-4">
              {selectedCell ? (
                <CellDetail cell={selectedCell.cell} studentName={selectedCell.student.studentName} />
              ) : (
                <p className="text-xs text-white/30 text-center py-6">
                  Haz clic en una celda para ver el detalle
                </p>
              )}
            </div>

            {/* Cluster List */}
            {snapshot.clusters.length > 0 && (
              <div className="backdrop-blur-md bg-white/5 border border-white/15 rounded-2xl p-4">
                <ClusterList clusters={snapshot.clusters} />
              </div>
            )}

            {/* AI Audit Panel */}
            <div className="backdrop-blur-md bg-white/5 border border-white/15 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                {t('teacher.insights.audit.title')}
              </p>

              {!audit && (
                <button
                  onClick={() => generateAudit(selectedClassroomId)}
                  disabled={isGeneratingAudit}
                  className="w-full py-2.5 px-4 rounded-xl backdrop-blur-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGeneratingAudit ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-300" />
                      {t('teacher.insights.generatingAudit')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      {t('teacher.insights.generateAudit')}
                    </>
                  )}
                </button>
              )}

              {audit && (
                <div className="space-y-3">
                  {/* Severity + Failure Type badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getSeverityColor(audit.severity)}`}>
                      {t(`teacher.insights.audit.severityLevels.${audit.severity}`)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300">
                      {t(`teacher.insights.audit.types.${audit.failureType}`)}
                    </span>
                  </div>

                  {/* Root Cause */}
                  <div>
                    <p className="text-xs font-medium text-white/50 mb-1">
                      {t('teacher.insights.audit.rootCause')}
                    </p>
                    <p className="text-xs text-white/70 leading-relaxed">{audit.rootCause}</p>
                  </div>

                  {/* Bridge Activity */}
                  <div>
                    <p className="text-xs font-medium text-white/50 mb-1">
                      {t('teacher.insights.audit.bridgeActivity')}
                    </p>
                    <div className="text-xs">
                      <SmartMarkdown content={audit.bridgeActivity} variant="chat" />
                    </div>
                  </div>

                  {/* Recommendations */}
                  {audit.recommendations.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-white/50 mb-1">
                        {t('teacher.insights.audit.recommendations')}
                      </p>
                      <ul className="space-y-1">
                        {audit.recommendations.map((rec, i) => (
                          <li key={i} className="flex gap-2 text-xs text-white/60">
                            <span className="text-emerald-400 flex-shrink-0 mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Regenerate */}
                  <button
                    onClick={() => generateAudit(selectedClassroomId)}
                    disabled={isGeneratingAudit}
                    className="w-full py-1.5 px-3 rounded-lg text-xs text-white/40 hover:text-white/60 border border-white/10 hover:border-white/20 transition-all disabled:opacity-50"
                  >
                    Regenerar diagnóstico
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
