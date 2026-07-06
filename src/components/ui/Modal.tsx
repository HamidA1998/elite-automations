import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  eyebrow?: string;
  size?: "default" | "wide" | "full";
}

const sizeClassName: Record<NonNullable<ModalProps["size"]>, string> = {
  default: "max-w-3xl",
  wide: "max-w-5xl",
  full: "max-w-[min(96vw,1200px)] h-[min(92vh,980px)]",
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  eyebrow = "Planner action",
  size = "default",
}: ModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 py-6 backdrop-blur-md md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`glass-panel max-h-[88vh] w-full overflow-auto rounded-[var(--radius-2xl)] border border-[var(--color-border)] p-6 ${sizeClassName[size]}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="section-kicker">{eyebrow}</p>
                <h2 className="display-title">{title}</h2>
                {description ? <p className="body-copy text-sm">{description}</p> : null}
              </div>
              <Button variant="ghost" className="size-11 rounded-full p-0" onClick={onClose}>
                <X size={18} />
              </Button>
            </div>
            <div className="mt-6">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
