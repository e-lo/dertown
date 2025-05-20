import logging

logger = logging.getLogger(__name__)


def mix_lists(list_1: list, list_2: list):
    """
    Mix events from two lists in an even distribution.
    """
    smaller_list = min(list_1, list_2, key=len)
    larger_list = max(list_1, list_2, key=len)
    final_list = list(larger_list)
    if not smaller_list:
        logging.warning(f"[WARNING]No smaller list, returning larger list: {len(final_list)}")
        return final_list
    interval = len(larger_list) // len(smaller_list)
    for i in range(len(smaller_list)):
        final_list.insert(i * interval, smaller_list[i])
    return final_list
