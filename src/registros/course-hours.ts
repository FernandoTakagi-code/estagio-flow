import type { CourseHours } from './course-hours-repository.js';
export { courseHours, type CourseHours } from './course-hours-repository.js';

export function summarizeCourse(rows: CourseHours[]) {
  return rows.reduce((summary, row) => ({
    cargaHorariaMinutos: summary.cargaHorariaMinutos + row.cargaHorariaMinutos,
    cargaHorariaVinculosMinutos: summary.cargaHorariaVinculosMinutos + (row.possuiVinculo ? row.cargaHorariaMinutos : 0),
    minutosAprovadosCurriculo: summary.minutosAprovadosCurriculo + Math.min(row.cargaHorariaMinutos, row.minutosAprovados),
    minutosRestantesCurriculo: summary.minutosRestantesCurriculo + Math.max(0, row.cargaHorariaMinutos - row.minutosAprovados),
  }), { cargaHorariaMinutos: 0, cargaHorariaVinculosMinutos: 0, minutosAprovadosCurriculo: 0, minutosRestantesCurriculo: 0 });
}
