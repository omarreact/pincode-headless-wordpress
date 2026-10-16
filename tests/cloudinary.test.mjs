import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractCloudinaryId } from '../src/lib/cloudinary.ts';

const previous = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'example-cloud';

test('extracts a versioned Cloudinary public ID', () => {
  assert.equal(
    extractCloudinaryId('https://res.cloudinary.com/example-cloud/image/upload/v1712345/blog/cover.jpg'),
    'blog/cover',
  );
});

test('strips transformations before version and removes only the final extension', () => {
  assert.equal(
    extractCloudinaryId('https://res.cloudinary.com/example-cloud/image/upload/f_auto,q_auto/w_400/v23/folder/a.b.webp'),
    'folder/a.b',
  );
});

test('preserves non-cloudinary URLs for remote fetch', () => {
  assert.equal(extractCloudinaryId('https://cms.example.org/wp-content/uploads/a.png'), 'https://cms.example.org/wp-content/uploads/a.png');
});

test('does not misclassify other Cloudinary accounts', () => {
  const remote = 'https://res.cloudinary.com/another-cloud/image/upload/v123/photo.jpg';
  assert.equal(extractCloudinaryId(remote), remote);
});

test('keeps public IDs that are passed directly', () => {
  assert.equal(extractCloudinaryId('press/cover'), 'press/cover');
});

test.after(() => {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  else process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = previous;
});
