import { useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/modal';
import { Feedback, useOperation } from './shared';
import type { Registry } from './types';

export type Catalog = 'classes' | 'disciplines' | 'fields';
export const catalogNames = { classes: 'Turmas', disciplines: 'Disciplinas', fields: 'Locais' };
export function Catalogs({ data, onNew }: { data: Registry; onNew: (kind: Catalog) => void }) {
  const [tab, setTab] = useState<Catalog>('classes');
  return <section><header className="section-header"><h2>Estrutura acadêmica</h2><Button onClick={() => onNew(tab)}>Adicionar {tab === 'classes' ? 'turma' : tab === 'disciplines' ? 'disciplina' : 'local'}</Button></header><div className="filter-tabs coord-tabs" aria-label="Cadastros acadêmicos">{(Object.keys(catalogNames) as Catalog[]).map((item) => <button key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>{catalogNames[item]}</button>)}</div>
    <div className="coord-list">{tab === 'classes' && data.classes.map((item) => <article className="coord-simple-row" key={item.id}><strong>{item.codigo}</strong><span>{data.enrollments.filter((enrollment) => enrollment.turmaId === item.id).length} alunos matriculados</span></article>)}{tab === 'disciplines' && data.disciplines.map((item) => <article className="coord-simple-row" key={item.id}><div><strong>{item.nome}</strong><p className="muted">{item.codigo}</p></div><span>{item.cargaHorariaTotal}h previstas</span></article>)}{tab === 'fields' && data.fields.map((item) => <article className="coord-simple-row" key={item.id}><strong>{item.nome}</strong><span>Local de estágio</span></article>)}{!data[tab].length && <p className="empty-state">Nenhum cadastro disponível. Use Adicionar para começar.</p>}</div>
  </section>;
}
export function NewCatalog({ kind, onClose, onChanged }: { kind: Catalog; onClose: () => void; onChanged: () => void }) {
  const operation = useOperation();
  return <Modal title={kind === 'classes' ? 'Nova turma' : kind === 'disciplines' ? 'Nova disciplina' : 'Novo local'} description="Este cadastro ficará disponível para organizar os grupos de estágio." onClose={() => { if (!operation.busy) onClose(); }}><Feedback error={operation.error} /><form className="record-form" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void operation.run(async () => {
      const body = kind === 'classes' ? { codigo: form.get('codigo') } : kind === 'fields' ? { nome: form.get('nome') } : { codigo: form.get('codigo'), nome: form.get('nome'), cargaHorariaTotal: Number(form.get('carga')) };
      await api(`/academico/${kind === 'classes' ? 'turmas' : kind === 'disciplines' ? 'disciplinas' : 'campos-estagio'}`, { method: 'POST', body }); onChanged(); onClose();
    });
  }}>{kind !== 'fields' && <label>Código<input name="codigo" required maxLength={50} /></label>}{kind !== 'classes' && <label>Nome<input name="nome" required minLength={2} maxLength={200} /></label>}{kind === 'disciplines' && <label>Carga horária total (horas)<input name="carga" type="number" required min={1} max={10000} step={1} /></label>}<div className="form-actions"><Button type="submit" disabled={operation.busy}>{operation.busy ? 'Salvando…' : 'Salvar cadastro'}</Button></div></form></Modal>;
}
