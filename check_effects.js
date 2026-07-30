const fs = require('fs');
const glob = require('glob');

glob("src/**/*.tsx", (err, files) => {
  files.forEach(f => {
    const code = fs.readFileSync(f, 'utf8');
    const matches = code.match(/useEffect\([\s\S]*?\}/g);
    if (matches) {
      matches.forEach(m => {
        // check if it ends with }, [something])
        const end = code.substr(code.indexOf(m) + m.length, 50);
      });
    }
  });
});
