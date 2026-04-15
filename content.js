// Shared utilities used by all site scripts

window.JobSprint = {

  async getProfile() {
    return new Promise(resolve => {
      chrome.storage.local.get(['profile', 'user', 'autoApply'], data => {
        resolve(data)
      })
    })
  },

  async isBlacklisted(companyName) {
    return new Promise(resolve => {
      chrome.storage.local.get('blacklist', data => {
        const list = data.blacklist || []
        const blocked = list.some(item =>
          item.company_name?.toLowerCase() === companyName?.toLowerCase()
        )
        resolve(blocked)
      })
    })
  },

  async isOverDailyLimit() {
    return new Promise(resolve => {
      chrome.storage.local.get(['stats', 'profile'], data => {
        const today = data.stats?.today || 0
        const max = data.profile?.max_apps_per_day || 50
        resolve(today >= max)
      })
    })
  },

  async logApplication(jobData) {
    return new Promise(resolve => {
      chrome.storage.local.get(['stats', 'activityLog'], data => {
        const stats = data.stats || { today: 0, total: 0, interviews: 0 }
        stats.today += 1
        stats.total += 1

        const log = data.activityLog || []
        const now = new Date()
        const time = now.toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit'
        })

        log.push({
          time,
          text: `Applied: ${jobData.jobTitle} at ${jobData.companyName}`,
          ...jobData,
        })

        if (log.length > 50) log.shift()

        chrome.storage.local.set({ stats, activityLog: log }, () => {
          fetch('http://localhost:3000/api/tracker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: data.profile?.user_id,
              ...jobData,
            })
          }).catch(() => {})

          resolve()
        })
      })
    })
  },

  async getAIAnswer(question, jobTitle, companyName) {
    return new Promise(resolve => {
      chrome.storage.local.get('profile', async data => {
        try {
          const res = await fetch('http://localhost:3000/api/answer-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: data.profile,
              question,
              jobTitle,
              companyName,
            })
          })
          const result = await res.json()
          resolve(result.answer || '')
        } catch {
          resolve('')
        }
      })
    })
  },

  async getCoverLetter(jobTitle, companyName, jobDescription) {
    return new Promise(resolve => {
      chrome.storage.local.get('profile', async data => {
        try {
          const res = await fetch('http://localhost:3000/api/cover-letter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: data.profile,
              jobTitle,
              companyName,
              jobDescription,
            })
          })
          const result = await res.json()
          resolve(result.coverLetter || '')
        } catch {
          resolve('')
        }
      })
    })
  },

  fillInput(element, value) {
    if (!element || !value) return
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set
    nativeSetter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  },

  fillTextarea(element, value) {
    if (!element || !value) return
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set
    nativeSetter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  },

  async clickButton(element, delay = 500) {
    if (!element) return
    await this.sleep(delay)
    element.click()
  },

  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector)
      if (el) return resolve(el)

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
        reject(new Error(`Timeout waiting for ${selector}`))
      }, timeout)
    })
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  showToast(message, type = 'success') {
    const existing = document.getElementById('js-toast')
    if (existing) existing.remove()

    const toast = document.createElement('div')
    toast.id = 'js-toast'
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: ${type === 'success' ? '#0f172a' : '#1a0a0a'};
      border: 1px solid ${type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};
      color: ${type === 'success' ? '#4ade80' : '#f87171'};
      padding: 12px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-family: -apple-system, sans-serif;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: slideUp 0.3s ease;
    `
    toast.innerHTML = `
      <span style="font-size:15px">${type === 'success' ? '✓' : '✗'}</span>
      <span>JobSprint: ${message}</span>
    `

    const style = document.createElement('style')
    style.textContent = `
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `
    document.head.appendChild(style)
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 4000)
  },
}