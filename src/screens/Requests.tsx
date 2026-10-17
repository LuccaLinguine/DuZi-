/**
 * The Requests screen (spec section 4) — queue what to write next, and
 * export the learner profile that `/stories` reads. Requests flip to `done`
 * on their own once a matching story syncs in (see lib/request-match.ts).
 */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/index.ts';
import type { RequestRow, Settings } from '../db/types.ts';
import { addRequest, deleteRequest, updateRequest, type NewRequestInput } from '../db/requests.ts';
import { gatherLearnerProfile } from '../db/profile.ts';
import { shareOrDownloadFile } from '../lib/share-file.ts';
import { LEVEL_LIST, levelBadge } from '../lib/levels.ts';
import { STORY_FORMATS, type StoryFormat } from '../lib/story-schema.ts';
import { TOPIC_CHIPS } from '../lib/topics.ts';
import { Screen, Section, EmptyState } from '../components/Screen.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';

const FORMAT_LABELS: Record<StoryFormat, string> = { story: 'Story', dialogue: 'Dialogue', article: 'Article' };

interface Props {
  defaultLevel: Settings['defaultLevel'];
}

type FormState = { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; request: RequestRow };

export function Requests({ defaultLevel }: Props) {
  const requests = useLiveQuery(() => db.requests.orderBy('createdAt').reverse().toArray(), []);
  const [form, setForm] = useState<FormState>({ mode: 'closed' });
  const [toDelete, setToDelete] = useState<RequestRow | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'working' | 'shared' | 'downloaded' | 'error'>('idle');

  // Series a "continue this series" pick can choose from — any series_id
  // already present on a (visible) story, labelled by its latest chapter.
  const series = useLiveQuery(async () => {
    const stories = await db.stories.filter((s) => !s.hidden && s.series_id !== null).toArray();
    const latest = new Map<string, { title: string; chapter: number }>();
    for (const s of stories) {
      const chapter = s.chapter ?? 0;
      const prev = latest.get(s.series_id!);
      if (!prev || chapter > prev.chapter) latest.set(s.series_id!, { title: s.title_zh, chapter });
    }
    return [...latest.entries()].map(([id, v]) => ({ id, label: `${v.title} (ch. ${v.chapter})` }));
  }, []);

  const queued = useMemo(() => (requests ?? []).filter((r) => r.status === 'queued'), [requests]);
  const done = useMemo(() => (requests ?? []).filter((r) => r.status === 'done'), [requests]);

  const handleExport = async () => {
    setExportState('working');
    try {
      const profile = await gatherLearnerProfile();
      const file = new File([JSON.stringify(profile, null, 2)], 'learner-profile.json', {
        type: 'application/json',
      });
      const result = await shareOrDownloadFile(file, '读字 learner profile');
      setExportState(result);
    } catch {
      setExportState('error');
    }
  };

  if (form.mode !== 'closed') {
    return (
      <RequestForm
        defaultLevel={defaultLevel}
        series={series ?? []}
        initial={form.mode === 'edit' ? form.request : undefined}
        onCancel={() => setForm({ mode: 'closed' })}
        onSave={async (input) => {
          if (form.mode === 'edit') await updateRequest(form.request.id, input);
          else await addRequest(input);
          setForm({ mode: 'closed' });
        }}
      />
    );
  }

  return (
    <Screen
      title="Requests"
      subtitle={queued.length === 0 ? undefined : `${queued.length} queued`}
      actions={
        <button
          type="button"
          onClick={() => setForm({ mode: 'add' })}
          className="tap rounded-lg px-3 text-[15px] font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          + Add
        </button>
      }
    >
      {requests === undefined ? (
        <p className="px-4 py-6 text-[14px]" style={{ color: 'var(--ink-3)' }}>
          Loading…
        </p>
      ) : requests.length === 0 ? (
        <EmptyState
          icon="请"
          title="Nothing queued"
          body="Add what you'd like to read next, then export your profile and drop it where Claude Code can find it. If the queue is empty when /stories runs, it writes a sensible default batch instead."
          action={
            <button
              type="button"
              onClick={() => setForm({ mode: 'add' })}
              className="tap rounded-lg px-4 text-[15px] font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Add a request
            </button>
          }
        />
      ) : (
        <>
          {queued.length > 0 && (
            <Section title="Queued">
              {queued.map((r) => (
                <RequestItem
                  key={r.id}
                  request={r}
                  onEdit={() => setForm({ mode: 'edit', request: r })}
                  onDelete={() => setToDelete(r)}
                />
              ))}
            </Section>
          )}
          {done.length > 0 && (
            <Section title="Done">
              {done.map((r) => (
                <RequestItem key={r.id} request={r} onDelete={() => setToDelete(r)} />
              ))}
            </Section>
          )}
        </>
      )}

      <Section title="Export">
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exportState === 'working'}
            className="tap w-full rounded-lg text-[15px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {exportState === 'working' ? 'Gathering…' : 'Export profile'}
          </button>
          <p className="mt-2 text-[13px]" style={{ color: 'var(--ink-3)' }}>
            {exportState === 'shared' && 'Shared — AirDrop it to your Mac, then run /stories.'}
            {exportState === 'downloaded' && 'Downloaded learner-profile.json — move it to your Mac and run /stories.'}
            {exportState === 'error' && 'Something went wrong gathering your profile. Try again.'}
            {exportState === 'idle' &&
              'Saves your level, learning words, read history and this queue to learner-profile.json.'}
          </p>
        </div>
      </Section>

      {toDelete && (
        <ConfirmDialog
          title={`Delete this request?`}
          body={`"${toDelete.topic}" (${levelBadge(toDelete.level)}) will be removed from the queue.`}
          confirmLabel="Delete"
          onConfirm={() => {
            void deleteRequest(toDelete.id);
            setToDelete(null);
          }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </Screen>
  );
}

function RequestItem({
  request,
  onEdit,
  onDelete,
}: {
  request: RequestRow;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  const body = (
    <div className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium">
          {request.topic} <span style={{ color: 'var(--ink-3)' }}>· {FORMAT_LABELS[request.format]}</span>
        </p>
        <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
          {levelBadge(request.level)} · {request.count} {request.count === 1 ? 'story' : 'stories'}
          {request.status === 'done' && ` · satisfied by ${request.fulfilledBy.length}`}
          {request.seriesId && ' · next chapter'}
        </p>
        {request.note && (
          <p className="mt-0.5 text-[12px] italic" style={{ color: 'var(--ink-3)' }}>
            {request.note}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete request"
        className="tap shrink-0 px-1 text-[13px]"
        style={{ color: 'var(--ink-3)' }}
      >
        Delete
      </button>
    </div>
  );

  if (!onEdit) {
    return (
      <div className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
        {body}
      </div>
    );
  }
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <button type="button" onClick={onEdit} className="w-full text-left">
        {body}
      </button>
    </div>
  );
}

function RequestForm({
  defaultLevel,
  series,
  initial,
  onCancel,
  onSave,
}: {
  defaultLevel: Settings['defaultLevel'];
  series: { id: string; label: string }[];
  initial: RequestRow | undefined;
  onCancel: () => void;
  onSave: (input: NewRequestInput) => void | Promise<void>;
}) {
  const [level, setLevel] = useState(initial?.level ?? defaultLevel);
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [format, setFormat] = useState<StoryFormat>(initial?.format ?? 'story');
  const [count, setCount] = useState(initial?.count ?? 1);
  const [seriesId, setSeriesId] = useState<string | null>(initial?.seriesId ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = topic.trim().length > 0;

  return (
    <Screen
      title={initial ? 'Edit request' : 'Add request'}
      actions={
        <button type="button" onClick={onCancel} className="tap -mr-2 px-2 text-[15px]" style={{ color: 'var(--accent)' }}>
          Cancel
        </button>
      }
    >
      <Section title="Level">
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {LEVEL_LIST.map((l) => (
            <Choice key={l.id} label={l.name} selected={level === l.id} onSelect={() => setLevel(l.id)} />
          ))}
        </div>
      </Section>

      <Section title="Topic">
        <div className="px-4 py-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Food, a ghost story, office drama…"
            className="w-full rounded-lg border px-3 py-2 text-[15px]"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {TOPIC_CHIPS.map((chip) => (
              <Choice key={chip} label={chip} selected={topic === chip} onSelect={() => setTopic(chip)} />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Format">
        <div className="flex gap-2 px-4 py-3">
          {STORY_FORMATS.map((f) => (
            <Choice key={f} label={FORMAT_LABELS[f]} selected={format === f} onSelect={() => setFormat(f)} />
          ))}
        </div>
      </Section>

      <Section title="How many">
        <div className="flex items-center gap-4 px-4 py-3">
          <button
            type="button"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            className="tap flex h-9 w-9 items-center justify-center rounded-full border text-[18px]"
            style={{ borderColor: 'var(--border)' }}
            aria-label="Fewer"
          >
            −
          </button>
          <span className="w-8 text-center text-[16px] font-medium">{count}</span>
          <button
            type="button"
            onClick={() => setCount((c) => Math.min(20, c + 1))}
            className="tap flex h-9 w-9 items-center justify-center rounded-full border text-[18px]"
            style={{ borderColor: 'var(--border)' }}
            aria-label="More"
          >
            +
          </button>
        </div>
      </Section>

      {series.length > 0 && (
        <Section title="Continue a series">
          <div className="px-4 py-3">
            <select
              value={seriesId ?? ''}
              onChange={(e) => setSeriesId(e.target.value || null)}
              className="w-full rounded-lg border px-3 py-2 text-[14px]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <option value="">Not a continuation</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </Section>
      )}

      <Section title="Note (optional)">
        <div className="px-4 py-3">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything specific to mention"
            className="w-full rounded-lg border px-3 py-2 text-[15px]"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          />
        </div>
      </Section>

      <div className="px-4 py-3">
        <button
          type="button"
          disabled={!canSave || saving}
          onClick={async () => {
            setSaving(true);
            await onSave({ level, topic, format, count, seriesId, note });
          }}
          className="tap w-full rounded-lg text-[16px] font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {initial ? 'Save changes' : 'Add to queue'}
        </button>
      </div>
      <div className="h-8" />
    </Screen>
  );
}

function Choice({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="tap rounded-lg border px-3 text-[14px]"
      style={{
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        background: selected ? 'var(--accent-soft)' : 'transparent',
        color: selected ? 'var(--accent)' : 'var(--ink-2)',
      }}
    >
      {label}
    </button>
  );
}
