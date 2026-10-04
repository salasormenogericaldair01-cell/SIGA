import run, { profile, handleSummary } from './read-only.js';
export const options = profile(1, '30s');
export { handleSummary };
export default run;
