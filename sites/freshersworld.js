;(async function () {
  const JS = window.JobSprint
  console.log('[JobSprint FreshersWorld] loaded, JS:', !!JS)
  if (!JS) return

  await JS.sleep(2000)

  const { profile, user, autoApply } = await JS.getProfile()
  const token = user?.token || ''

  console.log('[JobSprint FreshersWorld] profile:', !!profile, 'autoApply:', autoApply)
  if (!profile || !autoApply) return

  if (await JS.isOverDailyLimit()) {
    console.log('[JobSprint FreshersWorld] over daily limit')
    return
  }

  const path = window.location.pathname

  // ── Step 2: jobsearch results → apply to cards ────────────────────────────
  if (path.includes('/jobsearch/')) {
    await JS.sleep(2000)
    await scrollToLoadAll()
    await applyToListings(profile, token)
    return
  }

  // ── Step 3: individual job page → click Apply Now ─────────────────────────
  if (path.startsWith('/jobs/') && !path.includes('/jobsearch/')) {
    await JS.sleep(2000)
    await handleJobPage(profile, token)
    return
  }

  // ── Step 4: resume_upload redirect after successful apply → go back ───────
  if (path.includes('/user/resume_upload') || path.includes('success_status')) {
    console.log('[JobSprint FreshersWorld] Success redirect detected, going back')
    await JS.sleep(1000)
    const stored = await getStorage('fw_pending')
    const pending = stored?.fw_pending || {}
    if (pending.jobTitle) {
      const jobData = {
        job_title:    pending.jobTitle,
        company_name: pending.companyName,
        job_url:      pending.jobUrl,
        status:       'applied',
        job_site:     'freshersworld',
        applied_at:   new Date().toISOString(),
      }
      chrome.runtime.sendMessage({ type: 'APPLICATION_LOGGED', jobData }, () => {})
      await fetch('http://localhost:3000/api/tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pending.token}` },
        body: JSON.stringify(jobData),
      }).catch(() => {})
      JS.showToast(`✓ Applied: ${pending.jobTitle} at ${pending.companyName}`)
    }
    await clearStorage('fw_pending')
    await goBackToResults(profile)
    return
  }

  // ── Step 1: everything else → build URL and navigate ─────────────────────
  await JS.sleep(2000)
  await searchJobs(profile)

  // ─────────────────────────────────────────────────────────────────────────

  async function searchJobs(profile) {
    const role = getRole(profile)
    const city = getCity(profile)
    const courseName = getCourseName(profile)
    const roleSlug = role.toLowerCase().replace(/\s+/g, '-')
    const citySlug = city.toLowerCase().replace(/\s+/g, '-')
    const url = `https://www.freshersworld.com/jobs/jobsearch/${roleSlug}-jobs-for-${courseName}-in-${citySlug}`
    console.log('[JobSprint FreshersWorld] Navigating to:', url)
    JS.showToast(`Searching: ${role} in ${city}`)
    await JS.sleep(500)
    window.location.href = url
  }

  async function scrollToLoadAll() {
    let prev = 0
    for (let i = 0; i < 6; i++) {
      window.scrollTo(0, document.body.scrollHeight)
      await JS.sleep(1500)
      const curr = document.querySelectorAll('.job-container[job_id]').length
      console.log('[JobSprint FreshersWorld] Cards:', curr)
      if (curr === prev) break
      prev = curr
    }
    window.scrollTo(0, 0)
    await JS.sleep(500)
  }

  async function applyToListings(profile, token) {
    const MAX = 10
    let applied = 0

    const stored = await getStorage('fw_visited')
    const visited = new Set(stored?.fw_visited || [])

    const cards = Array.from(document.querySelectorAll('.job-container[job_id]'))
    console.log('[JobSprint FreshersWorld] Cards found:', cards.length)

    if (!cards.length) {
      JS.showToast('No jobs found', 'error')
      return
    }

    for (const card of cards) {
      if (applied >= MAX || await JS.isOverDailyLimit()) break

      const link = card.querySelector('.apply_btn a')
      if (!link) continue

      const jobUrl = link.getAttribute('href')
      if (!jobUrl || visited.has(jobUrl)) {
        console.log('[JobSprint FreshersWorld] Skipping visited:', jobUrl)
        continue
      }

      const jobTitle    = card.querySelector('h2, .job-role, a[title]')?.innerText?.trim() || 'Unknown Role'
      const companyName = card.querySelector('.company-name, .padding-none.company-name')?.innerText?.trim() || 'Unknown Company'

      if (await JS.isBlacklisted(companyName)) continue

      visited.add(jobUrl)
      await setStorage({ fw_visited: [...visited] })
      await setStorage({ fw_pending: { jobTitle, companyName, jobUrl, token, profile } })

      console.log('[JobSprint FreshersWorld] Going to:', jobUrl)
      window.location.href = jobUrl
      return
    }

    await clearStorage('fw_visited')
    console.log('[JobSprint FreshersWorld] Done. Applied:', applied)
    JS.showToast(`Applied to ${applied} jobs on FreshersWorld 🎉`)
  }

  async function mimicMouseMovement() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'MIMIC_MOUSE' }, resolve)
    })
  }

  async function handleJobPage(profile, token) {
    const stored = await getStorage('fw_pending')
    const pending = stored?.fw_pending || {}
    const jobTitle    = pending.jobTitle    || document.querySelector('h1, h2')?.innerText?.trim() || 'Unknown Role'
    const companyName = pending.companyName || 'Unknown Company'

    console.log('[JobSprint FreshersWorld] Job page:', jobTitle)

    // Skip if already applied
    const existingApplied = document.querySelector('[id^="already_applied_display_"]')
    if (existingApplied && existingApplied.style.display !== 'none') {
      console.log('[JobSprint FreshersWorld] Already applied, skipping')
      await clearStorage('fw_pending')
      await goBackToResults(profile)
      return
    }

    // Wait for apply button and jQuery to be ready
    let applyBtn = null
    for (let i = 0; i < 20; i++) {
      applyBtn = document.querySelector('span.view-apply-button')
      if (applyBtn && typeof window.$ === 'function') break
      await JS.sleep(500)
    }

    if (!applyBtn) {
      console.log('[JobSprint FreshersWorld] No apply button, skipping')
      await clearStorage('fw_pending')
      await goBackToResults(profile)
      return
    }

    console.log('[JobSprint FreshersWorld] Clicking apply button')
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 200, clientY: 300 }))
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: 201, clientY: 301 }))
    await JS.sleep(300)
    await mimicMouseMovement()
    await JS.sleep(300)
    applyBtn.click()

    // Wait up to 15 seconds for redirect
    await JS.sleep(15000)

    // If redirected to success page, Step 4 handles it
    if (window.location.href.includes('success_status') || window.location.href.includes('resume_upload')) {
      console.log('[JobSprint FreshersWorld] Success redirect detected')
      return
    }

    // If still on same page check already_applied div
    const appliedDiv = document.querySelector('[id^="already_applied_display_"]')
    if (appliedDiv && appliedDiv.style.display === 'block') {
      const jobData = {
        job_title:    jobTitle,
        company_name: companyName,
        job_url:      window.location.href,
        status:       'applied',
        job_site:     'freshersworld',
        applied_at:   new Date().toISOString(),
      }
      chrome.runtime.sendMessage({ type: 'APPLICATION_LOGGED', jobData }, () => {})
      await fetch('http://localhost:3000/api/tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(jobData),
      }).catch(() => {})
      JS.showToast(`✓ Applied: ${jobTitle} at ${companyName}`)
    }

    await JS.sleep(1500)
    await clearStorage('fw_pending')
    await goBackToResults(profile)
  }

  async function goBackToResults(profile) {
    const role       = getRole(profile)
    const city       = getCity(profile)
    const courseName = getCourseName(profile)
    const roleSlug   = role.toLowerCase().replace(/\s+/g, '-')
    const citySlug   = city.toLowerCase().replace(/\s+/g, '-')
    const url = `https://www.freshersworld.com/jobs/jobsearch/${roleSlug}-jobs-for-${courseName}-in-${citySlug}`
    await JS.sleep(500)
    window.location.href = url
  }

  function getRole(profile) {
    return (profile.preferred_roles?.[0] || profile.current_job_title || profile.skills?.[0] || 'Software Developer').trim()
  }

  function getCity(profile) {
    return (profile.preferred_cities?.[0] || profile.location || 'india').trim()
  }

  function getCourseName(profile) {
    const qual = (profile.highest_qualification || '').toLowerCase()
    if (qual.includes('mba') || qual.includes('pgdm'))       return 'mba-pgdm'
    if (qual.includes('mca'))                                 return 'mca'
    if (qual.includes('m.tech') || qual.includes('me'))      return 'me-mtech'
    if (qual.includes('msc'))                                 return 'msc'
    if (qual.includes('bca'))                                 return 'bca'
    if (qual.includes('bsc'))                                 return 'bsc'
    if (qual.includes('bcom') || qual.includes('b.com'))     return 'bcom'
    if (qual.includes('bba') || qual.includes('bbm'))        return 'bba-bbm'
    if (qual.includes('diploma'))                             return 'diploma'
    return 'be-btech'
  }

  function triggerReactChange(el, value) {
    const proto =
      el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype :
      el.tagName === 'SELECT'   ? window.HTMLSelectElement.prototype :
                                  window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, value); else el.value = value
    el.dispatchEvent(new Event('input',  { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
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