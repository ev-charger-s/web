import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const SUPPORT_LINKS = [
  {
    name: 'PayPal',
    url: 'https://paypal.me/zenedithPL',
    color: '#003087',
    colorHover: '#001F5C',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.629h6.724c2.332 0 3.978.498 4.896 1.481.857.917 1.166 2.199.919 3.815l-.008.052v.54l.42.238c.35.185.631.407.848.667.258.31.431.692.514 1.136.086.458.082.996-.012 1.6-.109.695-.304 1.3-.584 1.797a3.782 3.782 0 0 1-.97 1.177 3.848 3.848 0 0 1-1.26.702c-.474.164-1.026.28-1.638.345-.625.066-1.283.099-1.955.099H12.43a.925.925 0 0 0-.613.232.957.957 0 0 0-.311.579l-.026.148-.443 2.803-.02.106a.157.157 0 0 1-.05.092.142.142 0 0 1-.09.033H7.076zm1.817-13.77a.525.525 0 0 0-.518.444l-.828 5.252a.32.32 0 0 0 .317.371h1.283c1.548 0 2.673-.322 3.341-.955.674-.64.997-1.557.997-2.848 0-.87-.263-1.529-.784-1.958-.527-.434-1.35-.654-2.448-.654H8.893v.35-.001z"/>
      </svg>
    ),
  },
  {
    name: 'Ko-fi',
    url: 'https://ko-fi.com/K3K11ABGW5',
    color: '#FF5E5B',
    colorHover: '#E54542',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
      </svg>
    ),
  },
  {
    name: 'Patreon',
    url: 'https://patreon.com/Zenedith',
    color: '#FF424D',
    colorHover: '#E53A45',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524zM.003 23.537h4.22V.524H.003z"/>
      </svg>
    ),
  },
]

interface SupportModalProps {
  onClose: () => void
}

function SupportModal({ onClose }: SupportModalProps) {
  const { t } = useTranslation()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[min(90vw,360px)] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
            {t('support_title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
            aria-label={t('close')}
          >✕</button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-5">
          {t('support_description')}
        </p>

        {/* Links */}
        <div className="flex flex-col gap-3 mb-5">
          {SUPPORT_LINKS.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 rounded-xl text-white font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: link.color }}
            >
              <div className="flex items-center gap-3">
                {link.logo}
                <span>{link.name}</span>
              </div>
              <svg viewBox="0 0 24 24" className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
              </svg>
            </a>
          ))}
        </div>

        {/* Thanks */}
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          {t('support_thanks')}
        </p>
      </div>
    </div>
  )
}

export function SupportButton() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label={t('support_button')}
      >
        <span className="text-red-500">♥</span>
        <span className="hidden sm:inline">{t('support_button')}</span>
      </button>

      {isOpen && <SupportModal onClose={() => setIsOpen(false)} />}
    </>
  )
}
