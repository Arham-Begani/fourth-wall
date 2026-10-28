import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('tests/fixtures', { recursive: true });
const response = await fetch('https://storage.googleapis.com/mediapipe-assets/right_hands.jpg');
if (!response.ok) throw new Error(`Fixture download failed: ${response.status}`);
await writeFile('tests/fixtures/right_hands.jpg', Buffer.from(await response.arrayBuffer()));
console.log('Downloaded official MediaPipe right_hands.jpg test fixture.');
