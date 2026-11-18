import { useState, type Dispatch, type SetStateAction } from "react";
import { sanitizeGroupTargetsForSave } from "@/domain/portfolio";
import { buildStoredSectorsPayload, sectorDraftKey } from "@/domain/portfolio/target-draft-math";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useRemoveGroupTarget,
  useSaveGroupTarget,
  useSaveHierarchyTargets,
} from "@/state";
import type { GroupTarget } from "@/types";

export interface UseTargetsMutationsParams {
  classes: readonly string[];
  activeSectorClass: string;
  availableSectors: readonly string[];
  storedClassTargetsData: readonly GroupTarget[] | undefined;
  storedSectorTargetsData: readonly GroupTarget[] | undefined;
  classTargetOf: (className: string) => number;
  sectorTargetOf: (sectorName: string, className?: string) => number;
  setClassDraft: Dispatch<SetStateAction<Record<string, number>>>;
  setSectorDraft: Dispatch<SetStateAction<Record<string, number>>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

export function useTargetsMutations({
  classes,
  activeSectorClass,
  availableSectors,
  storedClassTargetsData,
  storedSectorTargetsData,
  classTargetOf,
  sectorTargetOf,
  setClassDraft,
  setSectorDraft,
  setError,
}: UseTargetsMutationsParams) {
  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard({
    moduleKey: "investments",
    defaultContext: "Definir Metas de Alocação",
  });

  const saveClassTarget = useSaveGroupTarget("class");
  const removeClassTarget = useRemoveGroupTarget("class");
  const saveSectorTarget = useSaveGroupTarget("sector");
  const removeSectorTarget = useRemoveGroupTarget("sector");
  const saveHierarchyTargets = useSaveHierarchyTargets();

  const [savingClass, setSavingClass] = useState<string | null>(null);
  const [savingSector, setSavingSector] = useState<string | null>(null);

  const runReadOnlyGuard = (context: string) => {
    if (!isReadOnlyMode) return false;
    guardAction(() => {}, context);
    return true;
  };

  const saveClass = async (className: string) => {
    if (runReadOnlyGuard("Definir Metas de Classes")) return;
    setError(null);
    setSavingClass(className);
    try {
      await saveClassTarget.mutateAsync({ name: className, target: classTargetOf(className) });
      setClassDraft((prev) => {
        const next = { ...prev };
        delete next[className];
        return next;
      });
      triggerSensory("success");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingClass(null);
    }
  };

  const saveClassDirect = async (className: string, target: number) => {
    if (runReadOnlyGuard("Definir Metas de Classes")) return;
    setError(null);
    try {
      await saveClassTarget.mutateAsync({ name: className, target });
      setClassDraft((prev) => {
        const next = { ...prev };
        delete next[className];
        return next;
      });
      triggerSensory("success");
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    }
  };

  const removeClass = async (className: string) => {
    if (runReadOnlyGuard("Remover Meta de Classe")) return;
    setError(null);
    setSavingClass(className);
    try {
      await removeClassTarget.mutateAsync(className);
      setClassDraft((prev) => {
        const next = { ...prev };
        delete next[className];
        return next;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingClass(null);
    }
  };

  const saveAllClasses = async () => {
    if (runReadOnlyGuard("Definir Metas de Classes")) return;
    setError(null);
    setSavingClass("all");
    try {
      const sanitized = sanitizeGroupTargetsForSave(
        classes.map((className) => ({ name: className, target: classTargetOf(className) })),
      );
      await saveHierarchyTargets.mutateAsync({
        classes: sanitized
          .filter((item) => item.target > 0)
          .map((item) => ({ name: item.name, target_percentage: item.target })),
        sectors: buildStoredSectorsPayload(storedSectorTargetsData ?? []),
      });
      setClassDraft({});
      triggerSensory("success");
      pushToast({ title: "Metas de classes salvas com sucesso!", variant: "success" });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingClass(null);
    }
  };

  const saveSector = async (sectorName: string) => {
    if (runReadOnlyGuard("Definir Metas Setoriais")) return;
    setError(null);
    setSavingSector(sectorName);
    try {
      await saveSectorTarget.mutateAsync({
        name: sectorName,
        target: sectorTargetOf(sectorName, activeSectorClass),
        className: activeSectorClass,
      });
      setSectorDraft((prev) => {
        const next = { ...prev };
        delete next[sectorDraftKey(activeSectorClass, sectorName)];
        return next;
      });
      triggerSensory("success");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSector(null);
    }
  };

  const saveSectorDirect = async (sectorName: string, target: number, className: string) => {
    if (runReadOnlyGuard("Definir Metas Setoriais")) return;
    setError(null);
    try {
      await saveSectorTarget.mutateAsync({
        name: sectorName,
        target,
        className,
      });
      setSectorDraft((prev) => {
        const next = { ...prev };
        delete next[sectorDraftKey(className, sectorName)];
        return next;
      });
      triggerSensory("success");
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    }
  };

  const removeSector = async (sectorName: string) => {
    if (runReadOnlyGuard("Remover Meta Setorial")) return;
    setError(null);
    setSavingSector(sectorName);
    try {
      await removeSectorTarget.mutateAsync({ name: sectorName, className: activeSectorClass });
      setSectorDraft((prev) => {
        const next = { ...prev };
        delete next[sectorDraftKey(activeSectorClass, sectorName)];
        return next;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSector(null);
    }
  };

  const saveAllSectorsForClass = async () => {
    if (runReadOnlyGuard("Definir Metas Setoriais")) return;
    setError(null);
    setSavingSector("all");
    try {
      const sanitized = sanitizeGroupTargetsForSave(
        availableSectors.map((sectorName) => ({
          name: sectorName,
          target: sectorTargetOf(sectorName, activeSectorClass),
        })),
      );
      const storedClasses = (storedClassTargetsData ?? [])
        .filter((item) => item.target_percentage > 0)
        .map((item) => ({ name: item.name, target_percentage: item.target_percentage }));

      await saveHierarchyTargets.mutateAsync({
        classes: storedClasses,
        sectors: buildStoredSectorsPayload(storedSectorTargetsData ?? [], activeSectorClass, sanitized),
      });
      setSectorDraft((prev) => {
        const prefix = `${activeSectorClass}::`;
        return Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix)));
      });
      triggerSensory("success");
      pushToast({ title: `Metas setoriais de ${activeSectorClass} salvas!`, variant: "success" });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSector(null);
    }
  };

  return {
    upgradeModal,
    savingClass,
    savingSector,
    saveClass,
    saveClassDirect,
    removeClass,
    saveAllClasses,
    saveSector,
    saveSectorDirect,
    removeSector,
    saveAllSectorsForClass,
  };
}
