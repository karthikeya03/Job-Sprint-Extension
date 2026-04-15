;(async function () {
  const JS = window.JobSprint
  console.log('[JobSprint] script loaded, JS:', !!JS)
  if (!JS) return

  await JS.sleep(2000)

  const { profile, autoApply } = await JS.getProfile()
  console.log('[JobSprint] profile:', !!profile, 'autoApply:', autoApply)
  if (!profile || !autoApply) return

  if (await JS.isOverDailyLimit()) {
    console.log('[JobSprint] over daily limit')
    return
  }

  let geminiBlocked = false
  let geminiBlockedUntil = 0

  const applyButton = await waitForElement(
    '#apply-button, [class*="applyBtn"], [class*="ApplyButton_applyBtn"]',
    15000
  )
  console.log('[JobSprint] apply button:', applyButton)
  if (!applyButton) return

  const buttonText = applyButton.textContent?.trim().toLowerCase() || ''
  if (buttonText === 'applied' || buttonText.includes('already applied')) {
    JS.showToast('Already applied to this job', 'info')
    return
  }

  const jobTitle = getJobTitle()
  const companyName = getCompanyName()

  if (await JS.isBlacklisted(companyName)) {
    JS.showToast(`Skipped ${companyName} (blacklisted)`, 'error')
    return
  }

  try {
    applyButton.click()
    await JS.sleep(1200)

    const chatContainer = await waitForElement(
      '#pwaChatBotContainer, [class*="chatBotContainer"], [class*="Chatbot_contentWrapper"]',
      30000
    )
    if (!chatContainer) {
      JS.showToast('Apply chat did not open', 'error')
      return
    }

    const success = await runChatLoop(profile, jobTitle, companyName)

    if (!success) {
      JS.showToast('Application confirmation not detected', 'error')
      return
    }

    const jobData = {
      job_title: jobTitle,
      company_name: companyName,
      job_url: window.location.href,
      status: 'applied',
      job_site: 'naukri',
      applied_at: new Date().toISOString(),
    }

    chrome.runtime.sendMessage({ type: 'APPLICATION_LOGGED', jobData }, () => {})

    const storage = await new Promise(resolve =>
      chrome.storage.local.get(['user', 'profile'], resolve)
    )
    const token = storage.user?.token || ''

    await fetch('http://localhost:3000/api/tracker', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(jobData),
    })

    JS.showToast(`Applied: ${jobTitle} at ${companyName}`)
  } catch (err) {
    console.error('JobSprint Naukri error:', err)
  }

  async function runChatLoop(profile, jobTitle, companyName) {
    const MAX_QUESTIONS = 20
    const LOOP_TIMEOUT_MS = 90000
    const answeredTexts = new Set()
    let questionsAnswered = 0

    return new Promise(resolve => {
      let settled = false
      let idleTimer = null
      let pollInterval = null

      function finish(result) {
        if (settled) return
        settled = true
        observer.disconnect()
        clearInterval(pollInterval)
        clearTimeout(idleTimer)
        resolve(result)
      }

      function resetIdleTimer() {
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => finish(false), LOOP_TIMEOUT_MS)
      }

      async function processNewMessages() {
        if (settled) return

        if (isSuccessState()) {
          finish(true)
          return
        }

        const unanswered = extractUnansweredBotMessages(answeredTexts)
        if (unanswered.length === 0) return

        for (const question of unanswered) {
          if (settled) return
          if (questionsAnswered >= MAX_QUESTIONS) {
            finish(false)
            return
          }

          const answer = await getAnswerFromApi(question, profile, jobTitle, companyName)
          if (!answer) continue

          answeredTexts.add(question)
          await fillAnswer(answer)
          questionsAnswered++
          await JS.sleep(800)

          if (isSuccessState()) {
            finish(true)
            return
          }
        }

        resetIdleTimer()
      }

      const observer = new MutationObserver(() => {
        resetIdleTimer()
        processNewMessages()
      })

      const chatList = document.querySelector(
        '[class*="chatbot_MessageContainer"], [class*="MessageContainer"], [id*="Messages"]'
      ) || document.body
      observer.observe(chatList, { childList: true, subtree: true })

      pollInterval = setInterval(() => {
        if (!settled) processNewMessages()
      }, 2000)

      resetIdleTimer()
      processNewMessages()
    })
  }

  function extractUnansweredBotMessages(answeredTexts) {
    const container = document.querySelector(
      '[class*="chatbot_MessageContainer"], [class*="MessageContainer"]'
    )
    if (!container) return []

    const items = container.querySelectorAll('li')
    const questions = []

    for (const item of items) {
      if (item.classList.toString().match(/sent|outgoing|right|user/i)) continue
      const text = item.textContent?.trim()
      if (!text || text.length < 5) continue
      if (answeredTexts.has(text)) continue
      const looksLikeQuestion = text.includes('?') || text.length > 15
      if (!looksLikeQuestion) continue
      questions.push(text)
    }

    return Array.from(new Set(questions))
  }

  function isSuccessState() {
    const toast = document.querySelector('.one-theme-toast.green')
    if (toast) return true
    const bodyText = document.body.textContent?.toLowerCase() || ''
    return bodyText.includes('applied successfully') || bodyText.includes('application submitted')
  }

  async function getAnswerFromApi(question, profileData, currentJobTitle, currentCompanyName) {
    try {
      if (geminiBlocked && Date.now() < geminiBlockedUntil) {
        return ''
      }

      const storage = await new Promise(resolve =>
        chrome.storage.local.get(['user', 'profile'], resolve)
      )
      const token = storage.user?.token || ''

      const res = await fetch('http://localhost:3000/api/answer-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          question,
          jobTitle: currentJobTitle,
          companyName: currentCompanyName,
          profile: profileData,
        }),
      })

      if (!res.ok) {
        if (res.status === 500 || res.status === 429) {
          geminiBlocked = true
          geminiBlockedUntil = Date.now() + 60000
        }
        return ''
      }

      geminiBlocked = false

      const payload = await res.json()
      let answer = (payload.answer || '').trim()

      if (answer.length > 150) {
        const truncated = answer.substring(0, 150)
        const lastDot = truncated.lastIndexOf('.')
        const lastComma = truncated.lastIndexOf(',')
        const cutPoint = lastDot > 50 ? lastDot + 1 : lastComma > 50 ? lastComma : 120
        answer = truncated.substring(0, cutPoint).trim()
      }

      return answer
    } catch {
      return ''
    }
  }

  async function fillAnswer(answer) {
    const aiLower = answer.toLowerCase()

    // Date inputs — check first
    const dayInput = document.querySelector('input[name="day"]')
    const monthInput = document.querySelector('input[name="month"]')
    const yearInput = document.querySelector('input[name="year"]')
    if (dayInput && monthInput && yearInput) {
      const today = new Date()
      const lastWorking = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter.call(dayInput, String(lastWorking.getDate()).padStart(2, '0'))
      dayInput.dispatchEvent(new Event('input', { bubbles: true }))
      setter.call(monthInput, String(lastWorking.getMonth() + 1).padStart(2, '0'))
      monthInput.dispatchEvent(new Event('input', { bubbles: true }))
      setter.call(yearInput, String(lastWorking.getFullYear()))
      yearInput.dispatchEvent(new Event('input', { bubbles: true }))
      await JS.sleep(500)
      clickSend()
      return
    }

    const radios = Array.from(document.querySelectorAll('input[type="radio"]')).filter(r => !r.checked)
    if (radios.length > 0) {
      let matched = false
      for (const radio of radios) {
        const val = radio.value.toLowerCase().trim()
        if (!val) continue
        if (val === aiLower.trim() || aiLower.includes(val) || val.includes(aiLower.trim())) {
          triggerReactChange(radio, radio.value)
          radio.click()
          matched = true
          break
        }
      }
      if (!matched) {
        triggerReactChange(radios[0], radios[0].value)
        radios[0].click()
      }
      await JS.sleep(1000)
      clickSend()
      return
    }

    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"], input.mcc__checkbox'))
      .filter(cb => !cb.checked)
    if (checkboxes.length > 0) {
      let matched = false
      for (const cb of checkboxes) {
        const val = cb.value.toLowerCase().trim()
        if (val && aiLower.includes(val)) {
          cb.click()
          matched = true
        }
      }
      if (!matched) checkboxes[0].click()
      await JS.sleep(300)
      clickSend()
      return
    }

    const contentEditable = document.querySelector(
      '[contenteditable="true"][data-placeholder*="message" i], [contenteditable="true"][class*="textArea"], [id*="InputBox"][contenteditable="true"]'
    )
    if (contentEditable) {
      contentEditable.focus()
      document.execCommand('selectAll', false, null)
      document.execCommand('delete', false, null)
      document.execCommand('insertText', false, answer)
      await JS.sleep(800)
      contentEditable.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, key: 'Enter', keyCode: 13
      }))
      await JS.sleep(300)
      clickSend()
      return
    }

    const input = document.querySelector(
      '[placeholder*="message" i], [placeholder*="type" i], [id*="InputBox"], textarea'
    )
    if (input) {
      triggerReactChange(input, answer)
      await JS.sleep(250)
      clickSend()
    }
  }

  function triggerReactChange(el, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      'value'
    )?.set
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value)
    } else {
      el.value = value
    }
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function clickSend() {
    const sendBtn = document.querySelector('div.sendMsg')
    if (sendBtn) {
      sendBtn.click()
      return
    }
    const saveBtn = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.trim().toLowerCase().includes('save'))
    if (saveBtn) saveBtn.click()
  }

  function getJobTitle() {
    return (
      document.querySelector('.jd-header-title, [class*="jd-header-title"], h1')
        ?.textContent?.trim() || 'Unknown Role'
    )
  }

  function getCompanyName() {
    return (
      document.querySelector(
        '.jd-header-comp-name, [class*="jd-header-comp-name"], [class*="comp-name"] a, [class*="comp-name"]'
      )?.textContent?.trim() || 'Unknown Company'
    )
  }

  function waitForElement(selector, timeout = 15000) {
    const existing = document.querySelector(selector)
    if (existing) return Promise.resolve(existing)

    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector)
        if (found) {
          observer.disconnect()
          resolve(found)
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
      setTimeout(() => {
        observer.disconnect()
        resolve(null)
      }, timeout)
    })
  }
})()