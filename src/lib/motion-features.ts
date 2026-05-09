/**
 * Lazy-loaded Framer Motion features
 * 
 * Using domMax (~25KB) because some components use layout animations.
 * If layout animations are removed, switch to domAnimation (~15KB).
 * 
 * This file is dynamically imported by LazyMotion, reducing initial
 * bundle from 34KB to ~4.6KB for pages that don't trigger animations.
 */
import { domMax } from "framer-motion";

export default domMax;
export const loadMotionFeatures = () => Promise.resolve(domMax);
