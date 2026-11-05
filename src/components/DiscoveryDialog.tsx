import { useEffect, useState, useCallback } from 'react';
import type { PackDiscoveryCard } from '../core/contracts';
import { speakText, stopSpeaking } from '../core/speech';

export interface DiscoveryDialogProps {
  discovery: PackDiscoveryCard;
  subjectLabel?: string;
  packTitle?: string;
  soundOn?: boolean;
  onClose: () => void;
}

export function DiscoveryCardDialog({
  discovery,
  subjectLabel,
  packTitle,
  soundOn = true,
  onClose,
}: DiscoveryDialogProps) {
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const handleSpeak = useCallback(() => {
    setSpeechError(null);
    setSpeaking(true);
    const spoken = speakText(discovery.text, {
      lang: 'vi-VN',
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: (err) => {
        setSpeaking(false);
        setSpeechError(err instanceof Error ? err.message : 'Chưa đọc được thẻ.');
      },
    });
    if (!spoken) setSpeaking(false);
  }, [discovery.text]);

  useEffect(() => {
    if (soundOn) {
      handleSpeak();
    }
    return () => {
      stopSpeaking();
    };
  }, [soundOn, handleSpeak]);

  const handleClose = () => {
    stopSpeaking();
    onClose();
  };

  return (
    <div className="overlay discovery-overlay" role="presentation">
      <div
        className="discovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Thẻ khám phá: ${discovery.title}`}
      >
        <div className="discovery-header">
          <span className="discovery-badge">🌟 THẺ KHÁM PHÁ MỚI</span>
          {subjectLabel && <span className="discovery-subject">{subjectLabel}</span>}
        </div>

        <div className="discovery-body">
          {discovery.imageFile ? (
            <div className="discovery-img-wrapper">
              <img
                src={discovery.imageFile.startsWith('/') || discovery.imageFile.startsWith('http') ? discovery.imageFile : `/api/media/${discovery.imageId ?? discovery.imageFile}`}
                alt={discovery.title}
                className="discovery-img"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="discovery-art-fallback" aria-hidden="true">
              🏛️
            </div>
          )}

          <h2>{discovery.title}</h2>
          {packTitle && <p className="discovery-subtitle">Thuộc bài: {packTitle}</p>}
          <div className="discovery-text-box">
            <p className="discovery-text">{discovery.text}</p>
          </div>

          {speechError && (
            <p className="discovery-speech-error" role="status">
              {speechError}
            </p>
          )}

          <div className="discovery-actions">
            <button
              type="button"
              className="button outline discovery-speak-btn"
              onClick={handleSpeak}
              aria-label="Đọc to bằng giọng tiếng Việt"
            >
              {speaking ? '🔊 Đang đọc…' : '🔊 Nghe đọc lại'}
            </button>
            <button
              type="button"
              className="button primary discovery-close-btn"
              onClick={handleClose}
            >
              Con đã hiểu, bắt đầu khám phá! →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface DiscoveryNotebookItem {
  packId: string;
  subjectLabel: string;
  packTitle: string;
  discovery: PackDiscoveryCard;
}

export interface DiscoveryNotebookDialogProps {
  cards: DiscoveryNotebookItem[];
  onClose: () => void;
}

export function DiscoveryNotebookDialog({ cards, onClose }: DiscoveryNotebookDialogProps) {
  const [selectedCard, setSelectedCard] = useState<DiscoveryNotebookItem | null>(
    cards[0] ?? null
  );
  const [speaking, setSpeaking] = useState(false);

  const handleSpeak = (text: string) => {
    stopSpeaking();
    setSpeaking(true);
    speakText(text, {
      lang: 'vi-VN',
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const handleClose = () => {
    stopSpeaking();
    onClose();
  };

  return (
    <div className="overlay discovery-overlay" role="presentation">
      <div
        className="discovery-notebook-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Sổ khám phá"
      >
        <div className="discovery-notebook-head">
          <h2>📖 Sổ Khám Phá Của Con</h2>
          <button type="button" className="button outline" onClick={handleClose}>
            Đóng ✕
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="discovery-notebook-empty">
            <p>Con chưa mở thẻ khám phá nào. Hãy phiêu lưu các chặng trên bản đồ để thu thập nhé!</p>
          </div>
        ) : (
          <div className="discovery-notebook-layout">
            <div className="discovery-notebook-list" role="list">
              {cards.map((c) => (
                <button
                  key={c.packId}
                  type="button"
                  className={`discovery-thumb-card ${
                    selectedCard?.packId === c.packId ? 'is-selected' : ''
                  }`}
                  onClick={() => {
                    setSelectedCard(c);
                    handleSpeak(c.discovery.text);
                  }}
                >
                  <span className="discovery-thumb-subject">{c.subjectLabel}</span>
                  <strong>{c.discovery.title}</strong>
                </button>
              ))}
            </div>

            {selectedCard && (
              <div className="discovery-notebook-detail">
                <h3>{selectedCard.discovery.title}</h3>
                <span className="discovery-subtitle">
                  {selectedCard.subjectLabel} · {selectedCard.packTitle}
                </span>
                <p className="discovery-text">{selectedCard.discovery.text}</p>
                <div className="discovery-actions">
                  <button
                    type="button"
                    className="button outline"
                    onClick={() => handleSpeak(selectedCard.discovery.text)}
                  >
                    {speaking ? '🔊 Đang đọc…' : '🔊 Nghe đọc'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
