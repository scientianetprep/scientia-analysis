/**
 * Lazy-loaded Framer Motion features
 * 
 * Using domMax (~25KB) because some components use layout animations.
 * If layout animations are removed, switch to domAnimation (~15KB).
 * 
 * This file is dynamically imported by MotionProvider, reducing initial
 * bundle from 34KB to ~4.6KB for pages that don't trigger animations.
 */
export { domMax as default } from "framer-motion";
