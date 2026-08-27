import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    const previousOverflow =
      document.body.style.overflow;

    /*
     * Prevent the page behind the modal
     * from scrolling while the modal is open.
     */
    document.body.style.overflow = 'hidden';

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const modal = (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        className={`modal-card ${
          wide ? 'modal-wide' : ''
        }`}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              Transaction
            </span>

            <h2 id="modal-title">
              {title}
            </h2>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>
      </section>
    </div>
  );

  return createPortal(
    modal,
    document.body,
  );
}