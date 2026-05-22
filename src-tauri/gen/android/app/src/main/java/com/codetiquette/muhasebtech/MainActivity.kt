package com.codetiquette.muhasebtech

import android.graphics.Color
import android.os.Bundle
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // App content is always light (CSS doesn't switch on prefers-color-scheme),
    // so force a light status-bar style (= dark icons). The default auto(...)
    // reads the OS dark-mode setting, which would pick light icons on a dark-mode
    // phone and make them invisible against our white background.
    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
    )
    super.onCreate(savedInstanceState)
  }
}
