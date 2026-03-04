const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'ProductionSection.tsx');
let txt = fs.readFileSync(filePath, 'utf8');

txt = txt.replace('useState("current")', 'useState("remito")');
txt = txt.replace('grid-cols-3', 'grid-cols-2');
const regexTrigger = /<TabsTrigger value="current"[\s\S]*?<\/TabsTrigger>\s*/g;
txt = txt.replace(regexTrigger, '');

const startIndex = txt.indexOf('<TabsContent value="current"');
const endIndexStr = '<TabsContent value="remito"';
const endIndex = txt.indexOf(endIndexStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const before = txt.substring(0, startIndex);
    const after = txt.substring(endIndex);
    fs.writeFileSync(filePath, before + after);
    console.log('Successfully updated ProductionSection.tsx');
} else {
    console.log('Could not find indices', startIndex, endIndex);
}
