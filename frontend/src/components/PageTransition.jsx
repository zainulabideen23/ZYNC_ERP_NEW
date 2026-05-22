import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'

const variants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
}

export default function PageTransition({ children }) {
    const { pathname } = useLocation()
    return (
        <motion.div
            key={pathname}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
            {children}
        </motion.div>
    )
}
