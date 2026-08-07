const { execSync } = require('child_process');
const output = execSync('cmd /c set', { encoding: 'utf8', windowsHide: false });
const env = output.split('\n');
const interesting = env.filter(l => {
  const k = l.split('=')[0].toUpperCase();
  return k.includes('GH_') || k.includes('GITHUB') || k.includes('TOKEN') || k.includes('AUTH') || k.includes('GIT_');
});
console.log('Environment variables of interest (names only):');
interesting.forEach(l => {
  const idx = l.indexOf('=');
  const name = l.substring(0, idx);
  const val = l.substring(idx + 1);
  console.log(name + ' = ' + '*'.repeat(val.length) + ' (len=' + val.length + ')');
});
if (interesting.length === 0) console.log('(none found)');
