'use client';

export type ActiveTracksDockProps = {
  rows: Array<{
    kind: 'ship' | 'transit' | 'flight';
    id: string;
    label: string;
    status: 'loading' | 'ready' | 'error';
  }>;
  onRemove: (kind: 'ship' | 'transit' | 'flight', id: string) => void;
  onClearAll: () => void;
  onFocus?: (kind: 'ship' | 'transit' | 'flight', id: string) => void;
};

const KIND_LABEL: Record<string, string> = {
  ship: 'SHIP',
  transit: 'TRANSIT',
  flight: 'FLIGHT',
};

export function ActiveTracksDock({ rows, onRemove, onClearAll, onFocus }: ActiveTracksDockProps) {
  if (!rows.length) return null;
  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom: 56,
        zIndex: 40,
        width: 260,
        maxHeight: 280,
        overflow: 'auto',
        background: 'rgba(12,12,10,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 6,
        padding: 8,
        fontFamily: 'ui-monospace, monospace',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span style={{ color: '#8A8880', fontSize: 9, letterSpacing: '0.12em' }}>ACTIVE TRACKS</span>
        <button
          type="button"
          onClick={onClearAll}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#E8E6E0',
            fontSize: 9,
            letterSpacing: '0.08em',
            padding: '3px 8px',
            cursor: 'pointer',
          }}
        >
          CLEAR ALL
        </button>
      </div>
      {rows.map((row) => (
        <div
          key={`${row.kind}:${row.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 0',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 10,
            color: '#E8E6E0',
          }}
        >
          <button
            type="button"
            onClick={() => onFocus?.(row.kind, row.id)}
            style={{
              flex: 1,
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: onFocus ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            <span style={{ color: '#5C5A54', marginRight: 6 }}>{KIND_LABEL[row.kind]}</span>
            {row.label}
            {row.status !== 'ready' ? (
              <span style={{ color: '#8A8880', marginLeft: 6 }}>{row.status.toUpperCase()}</span>
            ) : null}
          </button>
          <button
            type="button"
            aria-label={`Remove ${row.label}`}
            onClick={() => onRemove(row.kind, row.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8A8880',
              cursor: 'pointer',
              padding: 2,
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
