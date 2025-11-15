export function info(msg, obj = {}) {
  console.log(JSON.stringify({ level: 'info', msg, ...obj }));
}
export function warn(msg, obj = {}) {
  console.warn(JSON.stringify({ level: 'warn', msg, ...obj }));
}
export function error(msg, obj = {}) {
  console.error(JSON.stringify({ level: 'error', msg, ...obj }));
}
