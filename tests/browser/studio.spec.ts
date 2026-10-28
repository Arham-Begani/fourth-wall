import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('rehearsal catches, transfers and rescues through the real UI', async ({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{name:'Your chat. In your hands.'})).toBeVisible();
  await expect(page.getByTestId('caught-count')).not.toHaveText('00');
  await page.getByRole('button',{name:'Watch a handoff',exact:true}).click();
  await expect(page.getByTestId('handoff-count')).toHaveText('01');
  await expect(page.getByTestId('saved-count')).toHaveText('01');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Drop a test viewer'})).toBeDisabled();
  await page.getByRole('button',{name:'Reset stage'}).click();
  await expect(page.getByTestId('saved-count')).toHaveText('00');
  await page.getByRole('button',{name:'Drop a test viewer'}).click();
  await expect(page.getByTestId('caught-count')).toHaveText('01');
  await page.screenshot({path:'../../outputs/fourth-wall-desktop.png',fullPage:true});
  expect(errors).toEqual([]);
});
test('rehearsal chat validates commands and creates a viewer',async({page})=>{
  await page.goto('/');await page.getByRole('textbox',{name:'REHEARSAL CHAT'}).fill('hello');await page.getByRole('button',{name:'Send rehearsal command'}).click();await expect(page.getByRole('status')).toContainText('Try !join');
  await page.getByRole('button',{name:'Reset stage'}).click();await page.getByRole('textbox',{name:'REHEARSAL CHAT'}).fill('!join');await page.getByRole('button',{name:'Send rehearsal command'}).click();await expect(page.getByTestId('caught-count')).toHaveText('01');
});
test('Twitch setup is explicit, and unsigned OAuth callbacks are rejected',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Connect Twitch',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Twitch Client ID');await expect(page.getByRole('button',{name:'Continue to Twitch'})).toBeDisabled();await page.getByRole('button',{name:'Close dialog'}).click();
  await page.goto('/?oauth_callback_test=1#access_token=invalid-test-token&state=wrong');await expect(page.getByRole('alert')).toContainText('could not be verified');expect(page.url()).not.toContain('access_token');
});
test('camera denial gives a recoverable error and rehearsal still works',async({page})=>{
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Test denied','NotAllowedError');};});
  await page.goto('/');await page.getByRole('button',{name:'Your camera',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Camera access was not granted');await page.getByRole('button',{name:'Watch a handoff',exact:true}).click();await expect(page.getByTestId('saved-count')).toHaveText('01');
});
test('mobile layout has no horizontal overflow and all primary controls remain usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('button',{name:'Drop a test viewer'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Watch a handoff',exact:true}).click();await expect(page.getByTestId('saved-count')).toHaveText('01');await page.screenshot({path:'../../outputs/fourth-wall-mobile.png',fullPage:true});
});
test('broadcast mode preserves the session and exits with Escape',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Broadcast setup'}).click();await page.getByRole('button',{name:'Enter stage view'}).click();await expect(page.locator('.app')).toHaveClass(/stage-only/);await expect(page.getByTestId('game-stage')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.app')).not.toHaveClass(/stage-only/);
});
test('real MediaPipe model detects a two-hand test fixture through the camera pipeline',async({page})=>{
  test.setTimeout(90000);
  const photo=await readFile('tests/fixtures/right_hands.jpg');
  await page.addInitScript(async(dataUrl)=>{
    const image=new Image();image.src=dataUrl;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d')!;
    const draw=()=>{ctx.drawImage(image,0,0);requestAnimationFrame(draw);};draw();
    navigator.mediaDevices.getUserMedia=async()=>canvas.captureStream(30);
  },`data:image/jpeg;base64,${photo.toString('base64')}`);
  await page.goto('/');await page.getByRole('button',{name:'Your camera',exact:true}).click();
  await expect(page.locator('.stage-label')).toContainText('YOUR CAMERA',{timeout:60000});
  await expect(page.locator('.session-line').filter({hasText:'Hands tracked'})).toContainText('2 / 2',{timeout:30000});
  await page.getByRole('button',{name:'Drop a test viewer'}).click();
  await expect(page.getByTestId('caught-count')).toHaveText('01');
  await page.screenshot({path:'../../outputs/fourth-wall-tracking-fixture.png',fullPage:true});
  await page.getByRole('button',{name:'Demo hands',exact:true}).click();
  await expect(page.locator('.stage-label')).toContainText('REHEARSAL');
});
