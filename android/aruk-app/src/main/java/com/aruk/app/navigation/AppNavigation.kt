package com.aruk.app.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.aruk.app.screens.DashboardScreen
import com.aruk.app.screens.AccountsScreen
import com.aruk.app.screens.SecretsScreen
import com.aruk.app.screens.AnalyticsScreen
import com.aruk.app.screens.SettingsScreen
import com.aruk.app.screens.RoutingScreen

enum class ArukScreen(val route: String, val label: String) {
    DASHBOARD("dashboard", "Dashboard"),
    ACCOUNTS("accounts", "Accounts"),
    ROUTING("routing", "Routing"),
    ANALYTICS("analytics", "Analytics"),
    VAULT("vault", "Vault"),
    SETTINGS("settings", "Settings")
}

@Composable
fun AppNavigation(navController: NavHostController) {
    NavHost(navController, startDestination = ArukScreen.DASHBOARD.route) {
        composable(ArukScreen.DASHBOARD.route) { DashboardScreen() }
        composable(ArukScreen.ACCOUNTS.route) { AccountsScreen() }
        composable(ArukScreen.ROUTING.route) { RoutingScreen() }
        composable(ArukScreen.ANALYTICS.route) { AnalyticsScreen() }
        composable(ArukScreen.VAULT.route) { SecretsScreen() }
        composable(ArukScreen.SETTINGS.route) { SettingsScreen() }
    }
}