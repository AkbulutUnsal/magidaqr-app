// Kullanıcı elle bir dil seçtiğinde bunu işaretler.
// Bu işaret varsa, restoran bazlı otomatik dil geçişi (useAuth.jsx) devre dışı kalır —
// yani kullanıcının seçimi girişten girişe / yenilemeden yenilemeye kalıcı olur.
const KEY = 'magidaqr_lang_manual'

export function setManualLanguage(i18n, code) {
  i18n.changeLanguage(code)
  try { localStorage.setItem(KEY, '1') } catch { /* localStorage kapalıysa sessiz geç */ }
}

export function hasManualLanguage() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}
