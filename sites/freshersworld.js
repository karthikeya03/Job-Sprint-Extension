;(async function () {
  const JS = window.JobSprint
  if (!JS) return

  const { profile, autoApply } = await JS.getProfile()
  if (!profile || !autoApply) return
  if (await JS.isOverDailyLimit()) return

  await JS.sleep(2000)

  // Find apply buttons on this site
  const applyBtns = document.querySelectorAll(
    '.apply-btn, [class*="apply"], button[title*="Apply"]'
  )

  for (const btn of applyBtns) {
    if (await JS.isOverDailyLimit()) break
    if (!btn.textContent?.toLowerCase().includes('apply')) continue

    const jobCard = btn.closest('[class*="job"], [class*="listing"], article')
    if (!jobCard) continue

    const jobTitle = jobCard.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() || 'Unknown Role'
    const companyName = jobCard.querySelector('[class*="company"], [class*="org"]')?.textContent?.trim() || 'Unknown Company'

    if (await JS.isBlacklisted(companyName)) continue

    try {
      btn.click()
      await JS.sleep(1500)

      // Fill any forms that appear
      const form = document.querySelector('form[class*="apply"], [class*="apply-form"]')
      if (form) {
        const inputs = form.querySelectorAll('input, textarea')
        for (const input of inputs) {
          const label = input.placeholder || input.name || ''
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
        form.querySelector('[type="submit"]')?.click()
      }

      await JS.logApplication({
        jobTitle,
        companyName,
        jobSite: 'freshersworld',
        jobUrl: window.location.href,
        appliedAt: new Date().toISOString(),
        status: 'applied',
      })

      JS.showToast(`Applied: ${jobTitle} at ${companyName}`)
      await JS.sleep(2000)

    } catch (err) {
      console.log('JobSprint error:', err)
    }
  }
})()
