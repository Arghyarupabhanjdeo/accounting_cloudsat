import cron from 'node-cron';
import pool from "../db.js"
/**
 * Update expired subscriptions
 * Runs daily at midnight to check and update subscription statuses
 */
export const updateExpiredSubscriptions = async () => {
    try {
        console.log('Running subscription expiration check...');

        const [result] = await pool.query(
            `UPDATE subscriptions 
       SET status = 'expired' 
       WHERE status = 'active' 
       AND end_date < NOW()`
        );

        if (result.affectedRows > 0) {
            console.log(`✓ Updated ${result.affectedRows} expired subscription(s)`);
        } else {
            console.log('✓ No expired subscriptions found');
        }

        return result.affectedRows;
    } catch (error) {
        console.error('Error updating expired subscriptions:', error);
        throw error;
    }
};

/**
 * Initialize cron job for subscription expiration
 * Runs every day at midnight (00:00)
 */
export const initSubscriptionCron = () => {
    // Run every day at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('=== Scheduled Subscription Expiration Check ===');
        await updateExpiredSubscriptions();
    });

    console.log('✓ Subscription expiration cron job initialized (runs daily at midnight)');
};

/**
 * Manual trigger for testing purposes
 * Can be called via API endpoint
 */
export const manualExpireCheck = async (req, res) => {
    try {
        const affectedRows = await updateExpiredSubscriptions();

        res.json({
            success: true,
            message: `Checked and updated expired subscriptions`,
            expired_count: affectedRows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to update expired subscriptions'
        });
    }
};
