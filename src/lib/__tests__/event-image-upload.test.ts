import {
  validateImageUpload,
  buildImageObjectPath,
  MAX_IMAGE_BYTES,
} from '../event-image-upload';

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.log(`❌ FAIL: ${label}`);
    failures++;
  }
}

console.log('🧪 Testing event image upload validation\n');

const jpeg = validateImageUpload({ type: 'image/jpeg', size: 1000 });
check('jpeg accepted', jpeg.ok === true);
check('jpeg extension is jpg', jpeg.ok === true && jpeg.extension === 'jpg');

const png = validateImageUpload({ type: 'image/png', size: 1000 });
check('png extension is png', png.ok === true && png.extension === 'png');

const webp = validateImageUpload({ type: 'image/webp', size: 1000 });
check('webp extension is webp', webp.ok === true && webp.extension === 'webp');

const gif = validateImageUpload({ type: 'image/gif', size: 1000 });
check('gif rejected', gif.ok === false);

const empty = validateImageUpload({ type: 'image/png', size: 0 });
check('empty file rejected', empty.ok === false);

const tooBig = validateImageUpload({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 });
check('oversize rejected', tooBig.ok === false);

const atLimit = validateImageUpload({ type: 'image/png', size: MAX_IMAGE_BYTES });
check('exactly-at-limit accepted', atLimit.ok === true);

check(
  'object path is uuid.ext',
  buildImageObjectPath('abc-123', 'jpg') === 'abc-123.jpg'
);

console.log(`\n${failures === 0 ? '✅ All tests passed' : `❌ ${failures} test(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
