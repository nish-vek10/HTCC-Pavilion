// pavilion-app/src/lib/icons.js
// Central icon registry — all PNG icons mapped by name
// White icons use tintColor at render time
// Medal/trophy icons have their own colours — do not apply tintColor to those

const icons = {
  // ─── Tab bar ────────────────────────────────────────────────────────────
  home:         require('../../assets/icons/ic_home-TAB.png'),
  fixtures:     require('../../assets/icons/ic_fixtures-TAB.png'),
  stats:        require('../../assets/icons/ic_stats-TAB.png'),
  alerts:       require('../../assets/icons/ic_alerts-TAB.png'),
  profile:      require('../../assets/icons/ic_profile-TAB.png'),
  matchday:     require('../../assets/icons/ic_ADmatchday-TAB.png'),
  members:      require('../../assets/icons/ic_ADmembers-TAB.png'),
  training:     require('../../assets/icons/ic_ADtraining-TAB.png'),

  // ─── Fixture meta ────────────────────────────────────────────────────────
  date:         require('../../assets/icons/ic_date.png'),
  time:         require('../../assets/icons/ic_time.png'),
  venue:        require('../../assets/icons/ic_venue.png'),
  homeFixture:  require('../../assets/icons/ic_home_fixture.png'),
  awayFixture:  require('../../assets/icons/ic_away_fixture.png'),
  neutral:      require('../../assets/icons/ic_neutral.png'),

  // ─── Navigation ──────────────────────────────────────────────────────────
  back:         require('../../assets/icons/ic_back.png'),

  // ─── Actions ─────────────────────────────────────────────────────────────
  add:          require('../../assets/icons/ic_add.png'),
  edit:         require('../../assets/icons/ic_edit.png'),
  delete:       require('../../assets/icons/ic_delete.png'),
  send:         require('../../assets/icons/ic_send.png'),
  search:       require('../../assets/icons/ic_search.png'),
  filter:       require('../../assets/icons/ic_filter.png'),

  // ─── Roles and people ────────────────────────────────────────────────────
  approve:      require('../../assets/icons/ic_approve.png'),
  reject:       require('../../assets/icons/ic_reject.png'),
  pending:      require('../../assets/icons/ic_pending.png'),
  admin:        require('../../assets/icons/ic_admin.png'),
  signout:      require('../../assets/icons/ic_signout.png'),

  // ─── Squad badges ────────────────────────────────────────────────────────
  captainBadge: require('../../assets/icons/ic_captain_badge.png'),
  wkBadge:      require('../../assets/icons/ic_wk_badge.png'),
  squadOut:     require('../../assets/icons/ic_squad_out.png'),
  conflict:     require('../../assets/icons/ic_conflict.png'),

  // ─── Awards and sport — these have own colours, do NOT apply tintColor ──
  goldMedal:    require('../../assets/icons/ic_gold_medal.png'),
  silverMedal:  require('../../assets/icons/ic_silver_medal.png'),
  bronzeMedal:  require('../../assets/icons/ic_bronze_medal.png'),
  trophy:       require('../../assets/icons/ic_trophy.png'),
  cricketBat:   require('../../assets/icons/ic_cricket_bat.png'),
  cricketBowl:  require('../../assets/icons/ic_cricket_bowl.png'),
  cricketField: require('../../assets/icons/ic_cricket_field.png'),
}

export default icons