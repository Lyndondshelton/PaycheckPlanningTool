CREATE TABLE income_settings  (
    user_id TEXT PRIMARY KEY REFERENCES "user"(id),
    amount_cents BIGINT NOT NULL CHECK ( amount_cents >= 0),
    amount_is TEXT NOT NULL
        CHECK (amount_is IN ('paycheck', 'yearly', 'monthly', 'weekly')),
    pay_schedule TEXT NOT NULL
        CHECK (pay_schedule IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
    first_pay_day SMALLINT CHECK (first_pay_day BETWEEN 1 AND 31),
    second_pay_day SMALLINT CHECK (second_pay_day BETWEEN 1 AND 31),
    next_payday DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        pay_schedule <> 'semimonthly'
            OR (
            first_pay_day IS NOT NULL
                AND second_pay_day IS NOT NULL
                AND first_pay_day <> second_pay_day
            )
        )
);

CREATE TABLE recurring_bills (
    user_id TEXT NOT NULL REFERENCES "user"(id),
    bill_id TEXT PRIMARY KEY,
    bill_name TEXT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    bill_repeats TEXT NOT NULL
        CHECK (bill_repeats IN ('weekly','monthly','semiannually', 'yearly')),
    next_due_date DATE NOT NULL,
    UNIQUE(user_id, bill_name)
);

-- I think purchase name should be unique. There should not be multiple purchases named "Purchase". (similarly with other tables)
CREATE TABLE one_time_purchases (
    user_id TEXT NOT NULL REFERENCES "user"(id),
    purchase_id TEXT PRIMARY KEY,
    purchase_name TEXT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    purchase_date DATE NOT NULL,
    UNIQUE (user_id, purchase_name, purchase_date)
);

CREATE TABLE savings (
    user_id TEXT PRIMARY KEY REFERENCES "user"(id),
    current_savings_cents BIGINT NOT NULL DEFAULT 0
        CHECK (current_savings_cents >= 0),
    savings_goal_cents BIGINT CHECK (savings_goal_cents > 0)
);

CREATE TABLE savings_contributions(
    user_id TEXT NOT NULL REFERENCES "user"(id),
    savings_contr_id TEXT PRIMARY KEY,
    savings_contr_name TEXT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    savings_schedule TEXT NOT NULL
        CHECK (savings_schedule IN ('once', 'weekly', 'biweekly', 'monthly', 'payday')),
    savings_contr_date DATE NOT NULL,
    UNIQUE(user_id, savings_contr_name)
);

CREATE TABLE planner_settings(
    user_id TEXT PRIMARY KEY REFERENCES "user"(id),
    -- Plan.startingBalance may be negative so the forecast can cover an opening deficit.
    starting_balance_cents BIGINT NOT NULL DEFAULT 0,
    forecast_start_date DATE NOT NULL,
    -- Maps to Plan.horizon: HORIZONS and ForecastRange in lib/planner/planner.ts.
    -- TEXT stores both preset day counts and the 'custom' selection.
    selected_range TEXT NOT NULL
        CHECK (selected_range IN ('14', '28', '30', '60', '90', 'custom')),
    -- Plan.targetDate is optional for presets; retaining it preserves a previous custom date.
    custom_target_date DATE,
    -- Custom forecasts include both endpoints and are limited to MAX_FORECAST_DAYS = 365.
    CHECK (
        selected_range <> 'custom'
        OR (
            custom_target_date IS NOT NULL
            AND custom_target_date >= forecast_start_date
            AND custom_target_date - forecast_start_date < 365
        )
    )
);

CREATE TABLE savings_coverage_selections(
    user_id TEXT NOT NULL REFERENCES "user"(id),
    -- Each row represents one date in Plan.savingsCoverDates, not a fixed transfer amount.
    -- The forecast recalculates the amount from the cash shortfall and available savings.
    coverage_date DATE NOT NULL,
    -- A user can select multiple dates, but each date can be selected only once per user.
    PRIMARY KEY (user_id, coverage_date)
);
