package com.aruk.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import com.aruk.core.model.*
import com.aruk.ui.theme.*
import com.patrykandpatrick.vico.compose.cartesian.CartesianChartHost
import com.patrykandpatrick.vico.compose.cartesian.axis.rememberBottom
import com.patrykandpatrick.vico.compose.cartesian.axis.rememberStart
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberColumnCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberLine
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberLineCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.rememberCartesianChart
import com.patrykandpatrick.vico.compose.cartesian.rememberVicoScrollState
import com.patrykandpatrick.vico.core.cartesian.axis.HorizontalAxis
import com.patrykandpatrick.vico.core.cartesian.axis.VerticalAxis
import com.patrykandpatrick.vico.core.cartesian.data.CartesianChartModelProducer
import com.patrykandpatrick.vico.core.cartesian.data.CartesianValueFormatter
import com.patrykandpatrick.vico.core.cartesian.data.columnSeries
import com.patrykandpatrick.vico.core.cartesian.data.lineSeries
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// ════════════════════════════════════════════════════════════════
// Usage Line Chart — requests over time
// ════════════════════════════════════════════════════════════════

@Composable
fun UsageLineChart(
    dailyUsage: List<DailyUsage>,
    modifier: Modifier = Modifier,
    showCost: Boolean = false
) {
    val arukColors = LocalArukColors.current
    val modelProducer = remember { CartesianChartModelProducer() }
    val scrollState = rememberVicoScrollState()

    LaunchedEffect(dailyUsage) {
        withContext(Dispatchers.Default) {
            modelProducer.runTransaction {
                if (showCost) {
                    lineSeries {
                        series(dailyUsage.map { it.cost })
                    }
                } else {
                    lineSeries {
                        series(dailyUsage.map { it.requests.toFloat() })
                    }
                }
            }
        }
    }

    val bottomAxis = rememberBottom(
        valueFormatter = CartesianValueFormatter { _, value, _ ->
            val index = value.toInt()
            if (index in dailyUsage.indices) {
                dailyUsage[index].date.takeLast(5) // "MM-DD"
            } else ""
        },
        itemPlacer = remember { com.patrykandpatrick.vico.core.cartesian.axis.HorizontalAxis.ItemPlacer.step({ 5f }) }
    )

    val startAxis = rememberStart(
        valueFormatter = CartesianValueFormatter { _, value, _ ->
            if (showCost) "$${"%.1f".format(value)}"
            else "${"%.0f".format(value)}"
        }
    )

    GlassCard(modifier = modifier, padding = 16.dp) {
 Text(
            text = if (showCost) "Daily Cost" else "Daily Requests",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = arukColors.surface.textPrimary
        )
        Spacer(Modifier.height(12.dp))
        CartesianChartHost(
            chart = rememberCartesianChart(
                rememberLineCartesianLayer(
                    rememberLine(
                        shader = com.patrykandpatrick.vico.core.cartesian.layer.LineShader.color(arukColors.emerald.primary),
                    )
                ),
                bottomAxis = bottomAxis,
                startAxis = startAxis
            ),
            modelProducer = modelProducer,
            scrollState = scrollState,
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
        )
    }
}

// ════════════════════════════════════════════════════════════════
// Credits Bar Chart — remaining credits by provider
// ════════════════════════════════════════════════════════════════

@Composable
fun CreditsBarChart(
    creditsByProvider: Map<String, ProviderCredits>,
    modifier: Modifier = Modifier
) {
    val arukColors = LocalArukColors.current
    val modelProducer = remember { CartesianChartModelProducer() }
    val scrollState = rememberVicoScrollState()
    val providers = creditsByProvider.keys.toList()

    LaunchedEffect(creditsByProvider) {
        withContext(Dispatchers.Default) {
            modelProducer.runTransaction {
                columnSeries {
                    series(providers.map { creditsByProvider[it]?.remaining?.toFloat() ?: 0f })
                }
            }
        }
    }

    val bottomAxis = rememberBottom(
        valueFormatter = CartesianValueFormatter { _, value, _ ->
            val index = value.toInt()
            if (index in providers.indices) providers[index] else ""
        }
    )

    val startAxis = rememberStart(
        valueFormatter = CartesianValueFormatter { _, value, _ ->
            "$${"%.0f".format(value)}"
        }
    )

    GlassCard(modifier = modifier, padding = 16.dp) {
        Text(
            text = "Credits by Provider",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = arukColors.surface.textPrimary
        )
        Spacer(Modifier.height(12.dp))
        CartesianChartHost(
            chart = rememberCartesianChart(
                rememberColumnCartesianLayer(
                    columnCartesianLayerDecorator = com.patrykandpatrick.vico.core.cartesian.layer.ColumnCartesianLayerDecorator(
                        columnProvider = com.patrykandpatrick.vico.core.cartesian.layer.ColumnCartesianLayer.ColumnProvider.series(
                            com.patrykandpatrick.vico.core.cartesian.layer.ColumnCartesianLayer.ColumnProvider.series(fill = arukColors.emerald.primary)
                        )
                    )
                ),
                bottomAxis = bottomAxis,
                startAxis = startAxis
            ),
            modelProducer = modelProducer,
            scrollState = scrollState,
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
        )
    }
}

