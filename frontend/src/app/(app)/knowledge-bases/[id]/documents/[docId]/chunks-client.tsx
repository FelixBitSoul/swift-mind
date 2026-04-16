"use client"

import { useEffect } from "react"

export function DocumentChunksClient(props: { targetId: string | null }) {
  useEffect(() => {
    if (!props.targetId) return
    const el = document.getElementById(`chunk-${props.targetId}`)
    if (!el) return
    el.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [props.targetId])

  return null
}

