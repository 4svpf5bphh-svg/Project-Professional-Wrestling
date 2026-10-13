/**
 * The booking editor and its nested wrestler picker both lock the page.
 * Saving/restoring overflow independently can leave "hidden" behind when
 * React reruns effects or the nested sheet unmounts first.
 *
 * Reference count shared locks; restore the original overflow exactly once,
 * when the last sheet releases its lock.
 */
export type ScrollLockTarget = { style: { overflow: string } };

const locks = new WeakMap<ScrollLockTarget, { count: number; previousOverflow: string }>();

export function lockCardBackgroundScroll(target: ScrollLockTarget): () => void {
  const previous = locks.get(target);
  if (previous) {
    previous.count += 1;
  } else {
    locks.set(target, { count: 1, previousOverflow: target.style.overflow });
    target.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = locks.get(target);
    if (!current) return;
    current.count -= 1;
    if (current.count === 0) {
      target.style.overflow = current.previousOverflow;
      locks.delete(target);
    }
  };
}
