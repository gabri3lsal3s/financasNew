import { Camera, FileUp, UploadCloud } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface DropzoneProps {
  onFiles: (files: File[]) => void;
  onFileRejected?: (file: File, reason: "too-large" | "unsupported") => void;
  accept?: string;
  multiple?: boolean;
  maxSizeBytes?: number;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  capture?: "user" | "environment";
  enableCamera?: boolean;
  showActions?: boolean;
  extraActions?: ReactNode;
  children?: ReactNode;
}

/**
 * Dropzone próprio do app — substitui o `<input type="file">` nativo (DESIGN_SYSTEM §13 e AGENTS.md §4 Regra 7).
 * Os inputs de arquivo e câmera ficam 100% encapsulados e invisíveis; a superfície visível é do app.
 */
export function Dropzone({
  onFiles,
  onFileRejected,
  accept,
  multiple = false,
  maxSizeBytes,
  label = "Arraste um arquivo aqui ou clique para selecionar",
  hint,
  disabled,
  className,
  capture,
  enableCamera = false,
  showActions,
  extraActions,
  children,
}: DropzoneProps) {
  const inputId = useId();
  const cameraInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const shouldShowActions = showActions ?? Boolean(enableCamera || extraActions);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      let selected = Array.from(files);
      if (maxSizeBytes) {
        const rejected = selected.filter((file) => file.size > maxSizeBytes);
        if (rejected.length > 0 && onFileRejected) {
          rejected.forEach((f) => onFileRejected(f, "too-large"));
        }
        selected = selected.filter((file) => file.size <= maxSizeBytes);
      }
      if (!multiple) selected = selected.slice(0, 1);
      if (selected.length > 0) onFiles(selected);
    },
    [multiple, maxSizeBytes, onFiles, onFileRejected],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) handleFiles(event.dataTransfer.files);
  };

  return (
    <div
      role="button"
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-surface px-6 py-8 text-center select-none transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20",
        dragging && "border-primary bg-primary/5",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
        <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>

      {children}

      {shouldShowActions && (
        <div
          className="flex items-center gap-2 pt-2 flex-wrap justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {extraActions}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) inputRef.current?.click();
            }}
            className="gap-1.5 cursor-pointer"
          >
            <FileUp className="size-3.5" aria-hidden="true" />
            <span>Escolher arquivo</span>
          </Button>

          {enableCamera && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) cameraInputRef.current?.click();
              }}
              className="gap-1.5 cursor-pointer"
            >
              <Camera className="size-3.5" aria-hidden="true" />
              <span>Tirar foto</span>
            </Button>
          )}
        </div>
      )}

      {/* Input de arquivo principal encapsulado */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        onChange={handleInputChange}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
      />

      {/* Input de câmera secundário encapsulado quando habilitado */}
      {enableCamera && (
        <input
          ref={cameraInputRef}
          id={cameraInputId}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
        />
      )}
    </div>
  );
}
