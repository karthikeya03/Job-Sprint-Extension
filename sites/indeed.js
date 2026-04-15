;(async function () {
  const JS = window.JobSprint
  if (!JS) return

  const { profile, autoApply } = await JS.getProfile()
  if (!profile || !autoApply) return
  if (await JS.isOverDailyLimit()) return

  const url = window.location.href
  if (!url.includes('indeed.com')) return

  await JS.sleep(2000)

  const applyBtn = document.querySelector(
    '#indeedApplyButton, .jobsearch-IndeedApplyButton-newDesign, [data-testid="indeedApplyButton"]'
  )

  if (!applyBtn) return

  const jobTitle = document.querySelector(
    '.jobsearch-JobInfoHeader-title, h1[class*="title"]'
  )?.textContent?.trim() || 'Unknown Role'

  const companyName = document.querySelector(
    '[data-testid="inlineHeader-companyName"], .jobsearch-CompanyInfoContainer'
  )?.textContent?.trim() || 'Unknown Company'

  if (await JS.isBlacklisted(companyName)) {
    JS.showToast(`Skipped ${companyName} (blacklisted)`, 'error')
    return
  }

  try {
    applyBtn.click()
    await JS.sleep(2000)

    // Indeed opens in iframe or new tab
    // Handle form fields if present
    const form = document.querySelector('.ia-BasePage form, [data-testid="apply-form"]')
    if (form) {
      await fillIndeedForm(form, profile, jobTitle, companyName)
    }

    await JS.logApplication({
      jobTitle,
      companyName,
      jobSite: 'indeed',
      jobUrl: url,
      appliedAt: new Date().toISOString(),
      status: 'applied',
    })

    JS.showToast(`Applied: ${jobTitle} at ${companyName}`)

  } catch (err) {
    console.log('JobSprint Indeed error:', err)
  }

  async function fillIndeedForm(form, profile, jobTitle, companyName) {
    const inputs = form.querySelectorAll('input, textarea')
    for (const input of inputs) {
      if (input.value) continue
      const label = form.querySelector(`label[for="${input.id}"]`)?.textContent || input.placeholder || ''
      const l = label.toLowerCase()

      if (l.includes('name')) JS.fillInput(input, profile.full_name || '')
      else if (l.includes('email')) JS.fillInput(input, profile.email || '')
      else if (l.includes('phone')) JS.fillInput(input, profile.phone || '')
      else if (l.includes('experience')) JS.fillInput(input, String(profile.total_experience_years || 0))
      else if (input.tagName === 'TEXTAREA') {
        const answer = await JS.getAIAnswer(label, jobTitle, companyName)
        if (answer) JS.fillTextarea(input, answer)
      }
    }

    await JS.sleep(500)
    const submitBtn = form.querySelector('[type="submit"], button[class*="submit"]')
    if (submitBtn) submitBtn.click()
  }
})()