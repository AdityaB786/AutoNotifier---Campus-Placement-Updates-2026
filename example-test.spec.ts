import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://app.joinsuperset.com/#/s/feed');
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('bhatiaditya1010@gmail.com');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).press('CapsLock');
  await page.getByRole('textbox', { name: 'Password' }).fill('Adityabjiit21$');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('listitem').filter({ hasText: 'Job Profiles' }).click();
  await page.getByRole('tab', { name: 'All Jobs' }).click();
  await page.getByText('hours ago').click();
  await page.getByLabel('All Jobs').locator('div').filter({ hasText: 'Software EngineerVinsol' }).nth(2).click();
  await page.getByText('Vinsol Stadium').nth(1).click();
  await page.getByText('Dlehi').nth(1).click();
  await page.getByText('Full Time').click();
  await page.getByRole('tab', { name: 'Job Description' }).click();
  await page.getByText('Category:').click();
  await page.getByText('Job Functions:').click();
  await page.getByText('Job Profile CTC:').click();
  await page.getByRole('tab', { name: 'Eligibility Criteria' }).click();
  await page.getByText('UG - Required: 8 CGPA, Actual').click();
});