import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { entities, profileModules } from '@/api/apiClient';
import { Blocks, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import DynamicModuleWidget from '@/components/nexus/widgets/DynamicModuleWidget';
import { getBuiltinWidget } from '@/components/nexus/widgets/builtinWidgets';

/**
 * ModulesTab — the owner's profile modules, in the order they arranged them.
 *
 * Order lives in one place: `UserProfile.module_order`, an array of module_ids
 * whose index is the position. It is deliberately NOT stored on the
 * InstalledModule rows, because those answer a different question (which
 * modules exist) and keeping a per-row index consistent through installs,
 * uninstalls and reorders is exactly the kind of bookkeeping that drifts.
 *
 * The two are reconciled at render rather than at write time — see
 * `orderModules` below. That is what makes installing a module while a saved
 * order exists do the obvious thing (it appears at the end) instead of
 * vanishing because it isn't in the array yet.
 *
 * Only the profile owner gets the drag machinery. A visitor renders the same
 * order through a plain list, with no DndContext mounted at all.
 */

/**
 * Merge the saved order with what is actually installed.
 *   • ids in `order` that are no longer installed are dropped
 *   • installed modules missing from `order` are appended, in the list's own
 *     order, so a newly installed module shows up rather than disappearing
 */
function orderModules(modules, order) {
  if (!order?.length) return modules;
  const byId = new Map(modules.map(m => [m.id, m]));
  const arranged = [];
  for (const id of order) {
    const mod = byId.get(id);
    if (mod) { arranged.push(mod); byId.delete(id); }
  }
  return [...arranged, ...byId.values()];
}

export default function ModulesTab({ userId, isOwnProfile, moduleOrder }) {
  const queryClient = useQueryClient();

  const { data: installed = [], isLoading: loadingInstalled } = useQuery({
    queryKey: ['profile-modules', userId],
    queryFn: () => entities.InstalledModule.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const { data: allModules = [] } = useQuery({
    queryKey: ['modules'],
    queryFn: () => entities.Module.list('-install_count', 200),
  });

  // The saved layout arrives as a prop from HolographicProfile, which already
  // holds this profile record. Querying it again here would be a second
  // request for a document that is one component away.
  const savedOrder = moduleOrder;

  const installedIds = useMemo(() => installed.map(i => i.module_id), [installed]);
  const modules = useMemo(
    () => allModules.filter(m => installedIds.includes(m.id)),
    [allModules, installedIds],
  );

  // Local order is what the grid renders. It is seeded from the server and
  // then owned by the drag interaction until the next server round trip, so a
  // drop lands instantly instead of waiting on the network.
  const [localOrder, setLocalOrder] = useState(null);
  const [activeId, setActiveId] = useState(null);

  const serverOrdered = useMemo(
    () => orderModules(modules, savedOrder),
    [modules, savedOrder],
  );
  const serverIds = useMemo(() => serverOrdered.map(m => m.id).join('|'), [serverOrdered]);

  // Re-seed whenever the server's answer actually changes — a module was
  // installed or removed, or another tab saved a different arrangement.
  // Comparing joined ids rather than array identity keeps this from clobbering
  // an in-progress local order on every refetch.
  useEffect(() => { setLocalOrder(null); }, [serverIds]);

  const displayed = localOrder
    ? orderModules(modules, localOrder)
    : serverOrdered;

  const sensors = useSensors(
    // 6px of travel before a drag starts, so a click on a button inside a
    // widget (the Lo-fi Radio play button, the pet's feed action) still
    // registers as a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch needs a hold instead of a distance: on a phone the profile pane
    // scrolls vertically, and a distance-activated drag would hijack it.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persist = useCallback(async (order, previous) => {
    try {
      await profileModules.reorder(order);
      // Refresh the profile record the order arrived on, so a remount reads
      // the saved arrangement rather than the pre-drag one.
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
    } catch (error) {
      // Rolling back matters more than the toast: without it the user sees an
      // arrangement that silently reverts on their next page load, which reads
      // as the app losing their work at random.
      setLocalOrder(previous);
      toast.error(error?.data?.error || 'Could not save your module layout');
    }
  }, [queryClient, userId]);

  const handleDragEnd = (event) => {
    setActiveId(null);
    const { active, over } = event;
    // `over` is null when the module is dropped outside the list.
    if (!over || active.id === over.id) return;

    const current = displayed.map(m => m.id);
    const oldIndex = current.indexOf(active.id);
    const newIndex = current.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(current, oldIndex, newIndex);
    // Computed outside the state updater on purpose. Firing the request from
    // inside setState sends it twice under React StrictMode, which double-
    // invokes updaters in development.
    setLocalOrder(next);
    persist(next, current);
  };

  if (loadingInstalled) {
    return (
      <motion.div key="modules" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading...
      </motion.div>
    );
  }

  if (displayed.length === 0) {
    return (
      <motion.div key="modules" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center py-8 text-gray-500">
        <Blocks size={24} className="opacity-20 mb-2" />
        <p className="text-[10px] font-mono">NO MODULES INSTALLED</p>
      </motion.div>
    );
  }

  const renderModule = (mod) => {
    const BuiltinWidget = getBuiltinWidget(mod);
    // The 0.85 scale is the existing profile-pane fit. It stays on an INNER
    // element: dnd-kit writes its own transform onto the sortable node, and
    // the two would overwrite each other on the same element.
    return (
      <div className="transform scale-[0.85] origin-top-left w-[118%]">
        {BuiltinWidget
          ? <BuiltinWidget userId={userId} isOwnProfile={isOwnProfile} />
          : <DynamicModuleWidget mod={mod} userId={userId} isOwnProfile={isOwnProfile} />}
      </div>
    );
  };

  // Visitors get the arrangement without any of the drag machinery.
  if (!isOwnProfile) {
    return (
      <motion.div key="modules" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="space-y-3">
        {displayed.map(mod => <div key={mod.id}>{renderModule(mod)}</div>)}
      </motion.div>
    );
  }

  const activeModule = activeId ? displayed.find(m => m.id === activeId) : null;

  return (
    <motion.div key="modules" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="space-y-3">
      {displayed.length > 1 && (
        <p className="text-[9px] font-mono uppercase tracking-widest text-gray-600 flex items-center gap-1.5">
          <GripVertical size={10} /> Drag to rearrange
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => setActiveId(event.active.id)}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={displayed.map(m => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {displayed.map(mod => (
              <SortableModule key={mod.id} id={mod.id} label={mod.name}>
                {renderModule(mod)}
              </SortableModule>
            ))}
          </div>
        </SortableContext>

        {/* The lifted copy follows the cursor while the original holds its slot
            at reduced opacity, so the list never looks like it lost an item
            mid-drag. */}
        <DragOverlay>
          {activeModule ? (
            <div className="rounded-xl ring-2 ring-red-500/50 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
              {renderModule(activeModule)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </motion.div>
  );
}

/**
 * One draggable module. The handle is a narrow gutter down the left edge
 * rather than a floating button in a corner: the modules are real interactive
 * widgets with their own controls (play, feed, refresh), and an overlay button
 * parked on top of them would cover whichever control happened to be there.
 */
function SortableModule({ id, label, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Lifted above its neighbours so the dragged card is never clipped by
        // the module below it.
        zIndex: isDragging ? 40 : undefined,
        opacity: isDragging ? 0.35 : 1,
      }}
      className="relative group"
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${label || 'module'}`}
        title="Drag to reorder"
        className="absolute left-0 top-0 bottom-0 z-20 w-5 flex items-center justify-center rounded-l-xl
                   text-white/25 hover:text-white/70 opacity-0 group-hover:opacity-100 focus-visible:opacity-100
                   cursor-grab active:cursor-grabbing transition-opacity
                   bg-gradient-to-r from-black/60 to-transparent"
      >
        <GripVertical size={13} />
      </button>
      {children}
    </div>
  );
}
