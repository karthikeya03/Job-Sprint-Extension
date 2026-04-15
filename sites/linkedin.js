;(async function () {
  const JS = window.JobSprint
  if (!JS) return

  const { profile, autoApply } = await JS.getProfile()
  if (!profile || !autoApply) return
  if (await JS.isOverDailyLimit()) return

  const url = window.location.href
  const isJobsPage = url.includes('linkedin.com/jobs')
  if (!isJobsPage) return

  await JS.sleep(2500)

  // Find Easy Apply buttons
  const easyApplyBtns = document.querySelectorAll(
    '.jobs-apply-button, [aria-label*="Easy Apply"], button[class*="apply"]'
  )

  for (const btn of easyApplyBtns) {
    if (await JS.isOverDailyLimit()) break

    const btnText = btn.textContent?.trim().toLowerCase()
    if (!btnText?.includes('easy apply')) continue

    // Get job info
    const jobTitle = document.querySelector(
      '.job-details-jobs-unified-top-card__job-title, h1.t-24'
    )?.textContent?.trim() || 'Unknown Role'

    const companyName = document.querySelector(
      '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name'
    )?.textContent?.trim() || 'Unknown Company'

    if (await JS.isBlacklisted(companyName)) {
      JS.showToast(`Skipped ${companyName} (blacklisted)`, 'error')
      continue
    }

    try {
      btn.click()
      await JS.sleep(2000)

      // Handle Easy Apply modal
      await handleLinkedInModal(profile, jobTitle, companyName)

      await JS.logApplication({
        jobTitle,
        companyName,
        jobSite: 'linkedin',
        jobUrl: url,
        appliedAt: new Date().toISOString(),
        status: 'applied',
      })

      JS.showToast(`Applied: ${jobTitle} at ${companyName}`)
      await JS.sleep(2000)

    } catch (err) {
      console.log('JobSprint LinkedIn error:', err)
    }
  }

  async function handleLinkedInModal(profile, jobTitle, companyName) {
    // LinkedIn Easy Apply is multi-step
    let steps = 0
    const maxSteps = 8

    while (steps < maxSteps) {
      await JS.sleep(1000)

      const modal = document.querySelector('.jobs-easy-apply-modal')
      if (!modal) break

      // Fill phone if needed
      const phoneInput = modal.querySelector('input[name*="phone"], input[id*="phone"]')
      if (phoneInput && !phoneInput.value) {
        JS.fillInput(phoneInput, profile.phone || '')
      }

      // Fill text inputs
      const inputs = modal.querySelectorAll('input[type="text"], textarea')
      for (const input of inputs) {
        if (input.value) continue
        const label = input.closest('.artdeco-text-input--container')
          ?.querySelector('label')?.textContent?.trim() || input.placeholder || ''

        const labelLower = label.toLowerCase()

        if (labelLower.includes('years') || labelLower.includes('experience')) {
          JS.fillInput(input, String(profile.total_experience_years || 0))
        } else if (labelLower.includes('salary')) {
          JS.fillInput(input, String(profile.expected_salary_max || ''))
        } else if (input.tagName === 'TEXTAREA') {
          const answer = await JS.getAIAnswer(label, jobTitle, companyName)
          if (answer) JS.fillTextarea(input, answer)
        }
      }

      // Handle radio buttons / selects
      const selects = modal.querySelectorAll('select')
      for (const select of selects) {
        if (select.value) continue
        const label = select.closest('div')?.querySelector('label')?.textContent || ''
        const labelLower = label.toLowerCase()

        if (labelLower.includes('experience')) {
          // Select closest option to user's experience
          const options = Array.from(select.options)
          const target = profile.total_experience_years || 0
          const closest = options.find(o => o.text.includes(String(target)))
          if (closest) {
            select.value = closest.value
            select.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }
      }

      // Click Next or Submit
      const nextBtn = modal.querySelector(
        'button[aria-label*="Continue"], button[aria-label*="Next"], button[aria-label*="Review"]'
      )
      const submitBtn = modal.querySelector(
        'button[aria-label*="Submit application"]'
      )

      if (submitBtn) {
        submitBtn.click()
        await JS.sleep(1500)
        break
      } else if (nextBtn) {
        nextBtn.click()
        steps++
      } else {
        break
      }
    }
  }
})()