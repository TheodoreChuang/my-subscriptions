import { z } from 'zod'

export const WhoopPageSchema = <T extends z.ZodTypeAny>(recordSchema: T) =>
  z.object({
    records: z.array(recordSchema),
    next_token: z.string().optional(),
  })

export const WhoopCycleSchema = z.object({
  id: z.number(),
  start: z.string(),
  end: z.string().nullable(),
  timezone_offset: z.string(),
  score_state: z.string(),
  score: z
    .object({
      strain: z.number().optional(),
      kilojoule: z.number().optional(),
      average_heart_rate: z.number().optional(),
      max_heart_rate: z.number().optional(),
    })
    .optional(),
})

export const WhoopSleepSchema = z.object({
  id: z.string(),
  cycle_id: z.number(),
  nap: z.boolean(),
  score_state: z.string(),
  score: z
    .object({
      stage_summary: z
        .object({
          total_in_bed_time_milli: z.number().optional(),
          total_awake_time_milli: z.number().optional(),
          total_no_data_time_milli: z.number().optional(),
          total_light_sleep_time_milli: z.number().optional(),
          total_slow_wave_sleep_time_milli: z.number().optional(),
          total_rem_sleep_time_milli: z.number().optional(),
          sleep_cycle_count: z.number().optional(),
          disturbance_count: z.number().optional(),
        })
        .optional(),
      sleep_needed: z
        .object({
          baseline_milli: z.number().optional(),
          need_from_sleep_debt_milli: z.number().optional(),
          need_from_recent_strain_milli: z.number().optional(),
          need_from_recent_nap_milli: z.number().optional(),
        })
        .optional(),
      respiratory_rate: z.number().optional(),
      sleep_performance_percentage: z.number().optional(),
      sleep_consistency_percentage: z.number().optional(),
      sleep_efficiency_percentage: z.number().optional(),
    })
    .optional(),
})

export const WhoopRecoverySchema = z.object({
  cycle_id: z.number(),
  sleep_id: z.string(),
  score_state: z.string(),
  score: z
    .object({
      recovery_score: z.number().optional(),
      hrv_rmssd_milli: z.number().optional(),
      resting_heart_rate: z.number().optional(),
      spo2_percentage: z.number().optional(),
      skin_temp_celsius: z.number().optional(),
      user_calibrating: z.boolean().optional(),
    })
    .optional(),
})

export type WhoopCycle = z.infer<typeof WhoopCycleSchema>
export type WhoopSleep = z.infer<typeof WhoopSleepSchema>
export type WhoopRecovery = z.infer<typeof WhoopRecoverySchema>

export type WhoopRawData = {
  cycles: WhoopCycle[]
  sleeps: WhoopSleep[]
  recoveries: WhoopRecovery[]
}
