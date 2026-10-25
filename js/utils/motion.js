const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const active = new Set();
export const motionAllowed = () => !preference.matches && !document.hidden;

export function animateElement(element, frames, options = {}) {
    if (!element?.animate || !motionAllowed()) return null;
    const animation = element.animate(frames, { duration: 240, easing: 'cubic-bezier(.22, 1, .36, 1)', ...options });
    active.add(animation);
    animation.finished.catch(() => {}).finally(() => active.delete(animation));
    return animation;
}

export function settleAnimations(container) {
    for (const animation of active) {
        if (container.contains(animation.effect?.target)) animation.finish();
    }
}

export function animateLayout(element, previous) {
    if (!element || !previous || !motionAllowed()) return;
    const current = element.getBoundingClientRect();
    const x = previous.left - current.left;
    const y = previous.top - current.top;
    if (Math.abs(x) + Math.abs(y) < 2) return;
    element.getAnimations().forEach(animation => animation.cancel());
    animateElement(element, [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }], { duration: 380 });
}

function finishMotion() {
    if (preference.matches || document.hidden) for (const animation of active) animation.finish();
}
preference.addEventListener('change', finishMotion);
document.addEventListener('visibilitychange', finishMotion);
