import { useQueryClient } from "@tanstack/react-query";
import { 
  useApproveShipment, 
  useRejectShipment, 
  useUpdateShipmentFields,
  getListShipmentsQueryKey,
  getGetShipmentQueryKey,
  getGetShipmentEventsQueryKey,
  getGetShipmentCorrectionsQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function useShipmentActions(shipmentId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateShipmentQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListShipmentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetShipmentQueryKey(shipmentId) });
    queryClient.invalidateQueries({ queryKey: getGetShipmentEventsQueryKey(shipmentId) });
    queryClient.invalidateQueries({ queryKey: getGetShipmentCorrectionsQueryKey(shipmentId) });
  };

  const approve = useApproveShipment({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Shipment Approved",
          description: "The shipment has been marked as approved and will continue processing.",
        });
        invalidateShipmentQueries();
      },
      onError: (error: any) => {
        toast({
          title: "Failed to approve",
          description: error.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    }
  });

  const reject = useRejectShipment({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Shipment Rejected",
          description: "The shipment has been rejected.",
        });
        invalidateShipmentQueries();
      },
      onError: (error: any) => {
        toast({
          title: "Failed to reject",
          description: error.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    }
  });

  const updateFields = useUpdateShipmentFields({
    mutation: {
      onSuccess: (res) => {
        const corrections = res.data.corrections;
        if (corrections > 0) {
          toast({
            title: "Fields Updated",
            description: `Successfully saved ${corrections} field correction(s).`,
          });
          invalidateShipmentQueries();
        } else {
          toast({
            title: "No Changes",
            description: "No fields were modified.",
          });
        }
      },
      onError: (error: any) => {
        toast({
          title: "Failed to update",
          description: error.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    }
  });

  return {
    approve,
    reject,
    updateFields
  };
}
