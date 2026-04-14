<script setup lang="ts">
// Redirect immediately — the user cancelled Stripe checkout so they have no
// organization yet, meaning /app/** is inaccessible. Send them back to the
// subscription selection screen.
await navigateTo('/subscription', { replace: true })
</script>
