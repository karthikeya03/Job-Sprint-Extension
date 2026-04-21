;(async function () {
  const JS = window.JobSprint
  console.log('[JobSprint Hirist] loaded, JS:', !!JS)
  if (!JS) return

  await JS.sleep(2000)

  const { profile, user, autoApply } = await JS.getProfile()
  const token = user?.token || ''

  console.log('[JobSprint Hirist] profile:', !!profile, 'autoApply:', autoApply)
  if (!profile || !autoApply) return

  if (await JS.isOverDailyLimit()) return

  const path = window.location.pathname
  const href = window.location.href

  // ── Step 3: screening page ─────────────────────────────────────────────
  if (path.includes('/screening')) {
    await JS.sleep(2000)
    await handleScreening(profile, token)
    return
  }

  // ── Step: job applied success page → go back ──────────────────────────
  if (path.includes('/job/applied')) {
    await JS.sleep(1000)
    const stored = await getStorage('hirist_pending')
    const pending = stored?.hirist_pending || {}
    if (pending.jobTitle) {
      await logApplication(pending.jobTitle, pending.companyName, pending.jobUrl || window.location.href, pending.token)
    }
    await clearStorage('hirist_pending')
    const years = parseInt(profile.years_of_experience || profile.total_experience || '0')
    window.location.href = `https://www.hirist.tech/jobfeed?minexp=${years}&maxexp=${years + 1}`
    return
  }

  // ── Step 2: individual job page ────────────────────────────────────────
  if (path.startsWith('/j/')) {
    await JS.sleep(2000)
    await handleJobPage(profile, token)
    return
  }

  // ── Step 1: job feed ───────────────────────────────────────────────────
  if (href.includes('/jobfeed')) {
    await JS.sleep(3000)
    await applyToJobs(profile, token)
    return
  }

  // ─────────────────────────────────────────────────────────────────────

  function realClick(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }))
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  }

  function getExpValue(years) {
    if (years <= 1) return '2'
    if (years <= 3) return '3'
    if (years <= 6) return '4'
    if (years <= 10) return '5'
    if (years <= 15) return '6'
    if (years <= 20) return '7'
    if (years <= 25) return '8'
    return '9'
  }

  async function setFilters(profile) {
    try {
      const dropdowns = document.querySelectorAll('[aria-haspopup="listbox"]')

      // Experience filter
      const expDropdown = dropdowns[0]
      if (expDropdown) {
        realClick(expDropdown)
        await JS.sleep(1000)
        const years = parseInt(profile.years_of_experience || profile.total_experience || '0')
        const expValue = getExpValue(years)
        const expOption = [...document.querySelectorAll('[role="option"]')].find(o => o.dataset.value === expValue)
        if (expOption) {
          expOption.click()
          console.log('[JobSprint Hirist] Experience set:', expValue)
        }
        await JS.sleep(1500)
      }

      // Location filter
      const locDropdown = dropdowns[1]
      if (locDropdown) {
        locDropdown.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
        locDropdown.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }))
        locDropdown.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
        await JS.sleep(1000)

        const cityMap = { 'bengaluru': 'Bangalore', 'bengalore': 'Bangalore', 'mumbai': 'Mumbai', 'delhi': 'Delhi', 'hyderabad': 'Hyderabad', 'pune': 'Pune', 'chennai': 'Chennai', 'kolkata': 'Kolkata', 'noida': 'Noida', 'gurgaon': 'Gurgaon' }
        const city = (profile.preferred_cities?.[0] || profile.location || 'Bangalore').trim()
        const searchCity = cityMap[city.toLowerCase()] || city

        const searchInput = document.querySelector('input[placeholder="Search Any Location here..."]')
        if (searchInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          setter.call(searchInput, searchCity)
          searchInput.dispatchEvent(new Event('input', { bubbles: true }))
          await JS.sleep(1500)

          const locOption = [...document.querySelectorAll('[role="option"]')].find(
            o => o.textContent.trim() === searchCity
          )
          if (locOption) {
            locOption.click()
            console.log('[JobSprint Hirist] Location set:', searchCity)
          }
          await JS.sleep(1000)
        }
      }

      // Click Apply filter button
      const applyFilterBtn = [...document.querySelectorAll('button')].find(
        b => b.className.includes('mui-style-1kin2nq') && b.textContent.trim() === 'Apply'
      )
      if (applyFilterBtn) {
        applyFilterBtn.click()
        await JS.sleep(3000)
      }
    } catch (e) {
      console.log('[JobSprint Hirist] Filter error:', e)
    }
  }

  async function applyToJobs(profile, token) {
    await setFilters(profile)
    await JS.sleep(5000)

    const stored = await getStorage('hirist_visited')
    const visited = new Set(stored?.hirist_visited || [])

    const jobLinks = Array.from(document.querySelectorAll('a[href*="/j/"]'))
    console.log('[JobSprint Hirist] Job links found:', jobLinks.length)

    if (!jobLinks.length) {
      JS.showToast('No jobs found', 'error')
      return
    }

    for (const link of jobLinks) {
      if (await JS.isOverDailyLimit()) break
      const jobUrl = link.href
      if (!jobUrl || visited.has(jobUrl)) continue

      const card = link.closest('[class*="MuiCard"], [class*="joblist-card"], [class*="MuiPaper"]')
      const jobTitle = card?.querySelector('p, h2, h3')?.textContent?.trim() || 'Unknown Role'
      const companyName = card?.querySelector('[class*="company"], [class*="recruiter"]')?.textContent?.trim() || 'Unknown Company'

      visited.add(jobUrl)
      await setStorage({ hirist_visited: [...visited] })
      await setStorage({ hirist_pending: { jobTitle, companyName, jobUrl, token } })

      console.log('[JobSprint Hirist] Going to job:', jobTitle)
      window.location.href = jobUrl
      return
    }

    await clearStorage('hirist_visited')
    JS.showToast('Done applying on Hirist!')
  }

  async function handleJobPage(profile, token) {
    const stored = await getStorage('hirist_pending')
    const pending = stored?.hirist_pending || {}
    const jobTitle = pending.jobTitle || document.querySelector('h1, h2')?.textContent?.trim() || 'Unknown Role'
    const companyName = pending.companyName || 'Unknown Company'

    console.log('[JobSprint Hirist] Job page:', jobTitle)

    await JS.sleep(3000)

    // Find Apply button with class 1iinz9h
    const applyBtn = [...document.querySelectorAll('button')].find(
      b => b.textContent.trim() === 'Apply' && (b.className.includes('vfz69w') || b.className.includes('1iinz9h'))
    )

    if (!applyBtn) {
      console.log('[JobSprint Hirist] No apply button found')
      await goBack(profile)
      return
    }

    applyBtn.click()
    await JS.sleep(3000)

    // Check if screening page loaded
    if (window.location.href.includes('/screening')) {
      return // Step 3 handles it
    }

    // Check if directly applied
    const successMsg = document.body.textContent?.toLowerCase()
    if (successMsg?.includes('applied') || successMsg?.includes('success')) {
      await logApplication(jobTitle, companyName, pending.jobUrl || window.location.href, token)
      await clearStorage('hirist_pending')
      await goBack(profile)
    }
  }

  async function handleScreening(profile, token) {
    console.log('[JobSprint Hirist] Handling screening')

    const stored = await getStorage('hirist_pending')
    const pending = stored?.hirist_pending || {}
    const jobTitle = pending.jobTitle || 'Unknown Role'
    const companyName = pending.companyName || 'Unknown Company'

    await JS.sleep(1000)

    let maxLoops = 10
    while (maxLoops-- > 0) {
      // Handle radio buttons
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'))
      if (radios.length > 0) {
        const question = radios[0].closest('[class*="question"], [class*="screening"]')
          ?.querySelector('p, [class*="question-text"]')?.textContent?.trim() || 'Yes or No?'
        
        console.log('[JobSprint Hirist] Radio question:', question)
        const answer = await getAIAnswer(question, jobTitle, companyName, profile, token)
        
        let selected = false
        for (const radio of radios) {
          const container = radio.closest('div')
          const optionText = container?.textContent?.trim().toLowerCase() || ''
          if (answer.toLowerCase().includes(optionText) || optionText.includes(answer.toLowerCase())) {
            radio.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
            selected = true
            break
          }
        }
        if (!selected) {
          radios[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
        }
        await JS.sleep(500)
      }

      // Handle textareas
      const textareas = Array.from(document.querySelectorAll('textarea'))
      for (const textarea of textareas) {
        if (textarea.value) continue
        const question = textarea.closest('[class*="question"]')
          ?.querySelector('p, [class*="question-text"]')?.textContent?.trim() || textarea.placeholder
        
        console.log('[JobSprint Hirist] Text question:', question)
        const answer = await getAIAnswer(question, jobTitle, companyName, profile, token)
        if (!answer) continue

        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
        setter.call(textarea, answer)
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
        textarea.dispatchEvent(new Event('change', { bubbles: true }))
        await JS.sleep(300)
      }

      await JS.sleep(500)

      const emptyTextareas = Array.from(document.querySelectorAll('textarea')).filter(t => !t.value.trim())
      if (emptyTextareas.length > 0) {
        console.log('[JobSprint Hirist] Skipping Next - empty answers:', emptyTextareas.length)
        await JS.sleep(2000)
        continue
      }

      // Click Next
      const nextBtn = [...document.querySelectorAll('button')].find(
        b => b.textContent.trim() === 'Next' && !b.disabled
      )

      if (nextBtn) {
        console.log('[JobSprint Hirist] Clicking Next')
        nextBtn.click()
        await JS.sleep(2000)

        // Check if done
        const bodyText = document.body.textContent?.toLowerCase() || ''
        if (bodyText.includes('application submitted') || bodyText.includes('successfully applied') || 
            bodyText.includes('thank you') || !window.location.href.includes('/screening')) {
          await logApplication(jobTitle, companyName, pending.jobUrl || window.location.href, token)
          await clearStorage('hirist_pending')
          await goBack(profile)
          return
        }
      } else {
        break
      }
    }

    await clearStorage('hirist_pending')
    await goBack(profile)
  }

  async function goBack(profile) {
    const city = (profile.preferred_cities?.[0] || profile.location || 'Bangalore').trim()
    const years = parseInt(profile.years_of_experience || profile.total_experience || '0')
    await JS.sleep(500)
    window.location.href = `https://www.hirist.tech/jobfeed?minexp=${years}&maxexp=${years + 1}`
  }

  async function logApplication(jobTitle, companyName, jobUrl, token) {
    const jobData = {
      job_title: jobTitle,
      company_name: companyName,
      job_url: jobUrl,
      status: 'applied',
      job_site: 'hirist',
      applied_at: new Date().toISOString(),
    }
    chrome.runtime.sendMessage({ type: 'APPLICATION_LOGGED', jobData }, () => {})
    await fetch('http://localhost:3000/api/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(jobData),
    }).catch(() => {})
    JS.showToast(`✓ Applied: ${jobTitle} at ${companyName}`)
  }

  async function getAIAnswer(question, jobTitle, companyName, profile, token) {
    try {
      const res = await fetch('http://localhost:3000/api/answer-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ question, jobTitle, companyName, profile }),
      })
      const data = await res.json()
      return (data.answer || '').trim()
    } catch {
      return ''
    }
  }

  function getStorage(key) {
    return new Promise(r => chrome.storage.local.get(key, r))
  }

  function setStorage(data) {
    return new Promise(r => chrome.storage.local.set(data, r))
  }

  function clearStorage(key) {
    return new Promise(r => chrome.storage.local.remove(key, r))
  }

})()