import run, { profile, handleSummary } from './read-only.js';
export const options = profile(5, '1m');
export { handleSummary };
export default run;
