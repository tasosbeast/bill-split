import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import Modal from "./Modal";

interface RestoreSnapshotModalProps {
  onClose: () => void;
  onRestore: (file: File) => Promise<void> | void;
}

export default function RestoreSnapshotModal({
  onClose,
  onRestore,
}: RestoreSnapshotModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      if (!file) return;
      setError(null);
      setIsRestoring(true);
      Promise.resolve(onRestore(file))
        .then(() => {
          onClose();
        })
        .catch((err) => {
          const message =
            err instanceof Error
              ? err.message
              : "Restore failed. Please retry.";
          setError(message);
        })
        .finally(() => {
          setIsRestoring(false);
        });
    },
    [onRestore, onClose]
  );

  return (
    <Modal title="Restore Snapshot" onClose={onClose}>
      {() => (
        <form
          className="form-grid"
          onSubmit={(event) => event.preventDefault()}
        >
          <p className="kicker">
            Choose a previously exported backup file to overwrite the current
            snapshot.
          </p>
          <label className="kicker" htmlFor="restore-file">
            Backup file
          </label>
          <input
            id="restore-file"
            type="file"
            accept="application/json"
            className="input"
            onChange={handleFileChange}
            disabled={isRestoring}
          />
          <p className="helper">
            Your current friends and transactions will be replaced.
          </p>
          {error ? <div className="error">{error}</div> : null}
          <div className="row justify-end">
            <button
              type="button"
              className="button btn-ghost"
              onClick={onClose}
              disabled={isRestoring}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
