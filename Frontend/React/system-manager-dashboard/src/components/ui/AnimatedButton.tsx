import { motion } from 'framer-motion'
import styles from './ui.module.css'

export default function AnimatedButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <motion.button
      type="button"
      className={styles.animBtn}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
    >
      {children}
    </motion.button>
  )
}
