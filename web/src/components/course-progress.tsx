import type { Hours, Link, Panel } from '../lib/types';
import { hours } from '../lib/utils';

export function CourseProgress({ disciplines, links, panel }: { disciplines: Hours[]; links: Link[]; panel: Panel }) {
  return <section className="course-progress"><header className="section-header"><h2>Seu currículo de estágio</h2></header>
    <div className="course-summary" aria-label="Resumo da carga horária"><div><strong>{hours(panel.cargaHorariaMinutos ?? 0)}</strong><span>Exigidas no currículo</span></div><div><strong>{hours(panel.minutosAprovadosCurriculo ?? 0)}</strong><span>Cumpridas no currículo</span></div><div><strong>{hours(panel.minutosRestantesCurriculo ?? 0)}</strong><span>Restantes</span></div><div><strong>{hours(panel.cargaHorariaVinculosMinutos ?? 0)}</strong><span>Disciplinas com vínculo</span></div></div>
    <p className="field-hint course-explanation">As horas são cumpridas por disciplina. Excedentes de uma disciplina não compensam pendências de outra. Completar a carga horária não substitui a avaliação nem o fechamento da ficha.</p>
    <div className="course-head" aria-hidden="true"><span>Disciplina</span><span>Exigidas</span><span>Aprovadas</span><span>Enviadas</span><span>Restantes</span></div>
    {disciplines.map((course) => {
      const related = links.filter((link) => link.estagio.disciplina.id === course.disciplinaId);
      const active = related.some((link) => !link.encerradoEm && !link.estagio.encerradoEm);
      const percentage = course.cargaHorariaMinutos ? Math.min(100, Math.floor(course.minutosAprovados / course.cargaHorariaMinutos * 100)) : 0;
      return <article className="course-row" key={course.disciplinaId}><div className="course-name"><h3>{course.nome}</h3><p className="field-hint">{active ? 'Vínculo ativo' : course.possuiVinculo ? 'Vínculo encerrado · histórico preservado' : 'Aguardando vínculo da coordenação'}</p><div className="progress-track" role="progressbar" aria-label={course.nome} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percentage}%` }} /></div>{Boolean(course.minutosExcedentes) && <p className="field-hint course-excess">{hours(course.minutosExcedentes ?? 0)} excedentes nesta disciplina</p>}</div><div className="course-number"><span>Exigidas</span><strong>{hours(course.cargaHorariaMinutos)}</strong></div><div className="course-number"><span>Aprovadas</span><strong>{hours(course.minutosAprovados)}</strong></div><div className="course-number"><span>Enviadas</span><strong>{hours(course.minutosEnviados)}</strong></div><div className="course-number"><span>Restantes</span><strong>{hours(course.minutosRestantes ?? 0)}</strong></div></article>;
    })}
    {!disciplines.length && <p className="empty-state">O currículo ainda não foi cadastrado. Fale com a coordenação.</p>}
  </section>;
}
