package com.aruk.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.aruk.app.navigation.*
import com.aruk.app.screens.ConnectScreen
import com.aruk.app.screens.MainScreen
import com.aruk.ui.theme.*
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.Transparent),
            navigationBarStyle = SystemBarStyle.dark(Color.Transparent)
        )
        setContent {
            ArukTheme {
                MainContent()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainContent() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val arukColors = LocalArukColors.current

    // Determine if we're on a main tab
    val isMainScreen = ArukScreen.entries.any { it.route == currentRoute }

    Scaffold(
        containerColor = arukColors.surface.background,
        bottomBar = {
            if (isMainScreen) {
                NavigationBar(
                    containerColor = arukColors.surface.card,
                    contentColor = arukColors.surface.textPrimary
                ) {
                    ArukScreen.entries.forEach { screen ->
                        val selected = currentRoute == screen.route
                        val icon = when (screen) {
                            ArukScreen.DASHBOARD -> Icons.Rounded.Dashboard
                            ArukScreen.ACCOUNTS -> Icons.Rounded.Key
                            ArukScreen.ROUTING -> Icons.Rounded.SwapHoriz
                            ArukScreen.ANALYTICS -> Icons.Rounded.BarChart
                            ArukScreen.VAULT -> Icons.Rounded.Lock
                            ArukScreen.SETTINGS -> Icons.Rounded.Settings
                        }
                        NavigationBarItem(
                            icon = { Icon(icon, contentDescription = screen.label) },
                            label = { Text(screen.label, style = MaterialTheme.typography.labelSmall) },
                            selected = selected,
                            onClick = { navController.navigate(screen.route) { popUpTo(ArukScreen.DASHBOARD.route) } },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = arukColors.emerald.primary,
                                selectedTextColor = arukColors.emerald.primary,
                                unselectedIconColor = arukColors.surface.textMuted,
                                unselectedTextColor = arukColors.surface.textMuted,
                                indicatorColor = arukColors.emerald.primary.copy(alpha = 0.12f)
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.padding(innerPadding)) {
            AppNavigation(navController = navController)
        }
    }
}